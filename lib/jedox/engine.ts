// OLAP engine for the UNITY mock cube.
// Resolves any (entity, account, period, version, currency, measure) into a value,
// aggregating across entity hierarchy, account derivation rules, and time.

import {
  ENTITIES,
  ENTITIES_BY_ID,
  ENTITIES_BY_PROJECT,
  GROUPS,
  GROUPS_BY_ID,
  PROJECTS,
  PROJECTS_BY_GROUP,
  PROJECTS_BY_ID,
} from "./fixtures/portfolios";
import { FX_TO_EUR } from "./fixtures/industries";
import { getUniverse, entityProfile, type LeafCell } from "./generator";
import {
  ACCOUNT_DERIVED,
  ACCOUNT_LEAVES,
  VERSIONS,
  type CellRef,
  type VersionId,
} from "./schema";
import { periodToMonthIndex } from "./time";

// -------------------- Synthetic valuation accounts --------------------
// Accounts the commentary writer cites that aren't real cube cells but derive
// from the fair-value bridge identity. Making these first-class resolvable
// ensures citation chips show meaningful numbers, not 0.

const SYNTHETIC_VAL_VERSIONS: string[] = [VERSIONS.ValuationV1, VERSIONS.ValuationV2];

const SYNTHETIC_ACCOUNTS = new Set<string>([
  "FairValue",
  "Multiple",
  "Bridge:ebitdaEffect",
  "Bridge:multipleEffect",
  "Bridge:crossTerm",
  "Bridge:leverageEffect",
  "Bridge:fxEffect",
  "Bridge:otherEffect",
  "Bridge:total",
]);

interface BridgeLegs {
  ebitdaEffect: number;
  multipleEffect: number;
  crossTerm: number;
  leverageEffect: number;
  fxEffect: number;
  otherEffect: number;
  total: number;
}
interface BridgeSnapshot {
  period: string;
  ebitda: number;
  multiple: number;
  netDebt: number;
  fx: number;
  fv: number;
}

/** Entity-level (leaf or rollup) bridge. Uses universe data for leaves; aggregates for rollups. */
export function getEntityBridge(entityId: string):
  | { entity: string; v1: BridgeSnapshot; v2: BridgeSnapshot; legs: BridgeLegs; currency: "EUR" }
  | null {
  const universe = getUniverse();
  const val = universe.valuations[entityId];
  if (!val) {
    // Rollup: aggregate all leaves
    const leaves = expandEntityToLeaves(entityId);
    if (!leaves.length) return null;
    const children = leaves
      .map((id) => getEntityBridge(id))
      .filter((b): b is NonNullable<ReturnType<typeof getEntityBridge>> => b !== null);
    if (!children.length) return null;
    const weightSum = children.reduce((a, b) => a + b.v1.ebitda * b.v1.fx, 0) || 1;
    const wAvgMult = (snap: "v1" | "v2") =>
      children.reduce((a, b) => a + (b[snap].ebitda * b[snap].fx * b[snap].multiple), 0) /
      (children.reduce((a, b) => a + b[snap].ebitda * b[snap].fx, 0) || 1);
    const aggV1: BridgeSnapshot = {
      period: children[0].v1.period,
      ebitda: children.reduce((a, b) => a + b.v1.ebitda * b.v1.fx, 0),
      multiple: wAvgMult("v1"),
      netDebt: children.reduce((a, b) => a + b.v1.netDebt * b.v1.fx, 0),
      fx: 1,
      fv: children.reduce((a, b) => a + b.v1.fv, 0),
    };
    const aggV2: BridgeSnapshot = {
      period: children[0].v2.period,
      ebitda: children.reduce((a, b) => a + b.v2.ebitda * b.v2.fx, 0),
      multiple: wAvgMult("v2"),
      netDebt: children.reduce((a, b) => a + b.v2.netDebt * b.v2.fx, 0),
      fx: 1,
      fv: children.reduce((a, b) => a + b.v2.fv, 0),
    };
    const total = aggV2.fv - aggV1.fv;
    const sum = (k: keyof BridgeLegs) => children.reduce((a, b) => a + b.legs[k], 0);
    const legs: BridgeLegs = {
      ebitdaEffect: sum("ebitdaEffect"),
      multipleEffect: sum("multipleEffect"),
      crossTerm: sum("crossTerm"),
      leverageEffect: sum("leverageEffect"),
      fxEffect: sum("fxEffect"),
      otherEffect:
        total -
        (sum("ebitdaEffect") +
          sum("multipleEffect") +
          sum("crossTerm") +
          sum("leverageEffect") +
          sum("fxEffect")),
      total,
    };
    // Avoid unused warning
    void weightSum;
    return { entity: entityId, v1: aggV1, v2: aggV2, legs, currency: "EUR" };
  }

  const { v1, v2 } = val;
  const deltaEBITDA = v2.ebitda - v1.ebitda;
  const deltaMultiple = v2.multiple - v1.multiple;
  const deltaNetDebt = v2.netDebt - v1.netDebt;
  const fxAvg = (v1.fx + v2.fx) / 2;

  const ebitdaEffect = deltaEBITDA * v1.multiple * fxAvg;
  const multipleEffect = v1.ebitda * deltaMultiple * fxAvg;
  const crossTerm = deltaEBITDA * deltaMultiple * fxAvg;
  const leverageEffect = -deltaNetDebt * fxAvg;
  const fxEffect = (v2.ebitda * v2.multiple - v2.netDebt) * (v2.fx - v1.fx);
  const total = v2.fv - v1.fv;
  const otherEffect =
    total - (ebitdaEffect + multipleEffect + crossTerm + leverageEffect + fxEffect);

  return {
    entity: entityId,
    v1: {
      period: v1.period,
      ebitda: v1.ebitda,
      multiple: v1.multiple,
      netDebt: v1.netDebt,
      fx: v1.fx,
      fv: v1.fv,
    },
    v2: {
      period: v2.period,
      ebitda: v2.ebitda,
      multiple: v2.multiple,
      netDebt: v2.netDebt,
      fx: v2.fx,
      fv: v2.fv,
    },
    legs: {
      ebitdaEffect,
      multipleEffect,
      crossTerm,
      leverageEffect,
      fxEffect,
      otherEffect,
      total,
    },
    currency: "EUR",
  };
}

function resolveSynthetic(
  entity: string,
  account: string,
  version: string
): ResolvedValue | null {
  const bridge = getEntityBridge(entity);
  if (!bridge) return null;
  const snap = version === VERSIONS.ValuationV1 ? bridge.v1 : bridge.v2;
  const synthRef: CellRef = {
    cube: "FIN_CUBE",
    entity,
    account,
    time: snap.period,
    version,
    currency: "EUR",
    measure: "Value",
  };
  const basePR: CellRef[] = [
    { cube: "FIN_CUBE", entity, account: ACCOUNT_DERIVED.EBITDA, time: snap.period, version, currency: "EUR", measure: "Value" },
    { cube: "FIN_CUBE", entity, account: ACCOUNT_DERIVED.NetDebt, time: snap.period, version, currency: "EUR", measure: "Value" },
  ];
  if (account === "FairValue") {
    return {
      value: snap.fv,
      currency: "EUR",
      provenance: [...basePR, synthRef],
      rule: "EV/EBITDA method · EBITDA × Multiple − NetDebt (post-FX)",
      derived: true,
    };
  }
  if (account === "Multiple") {
    return {
      value: snap.multiple,
      currency: "EUR",
      provenance: [synthRef],
      rule: "EV/EBITDA multiple (primary method — sector comps)",
      derived: true,
    };
  }
  if (account.startsWith("Bridge:")) {
    const key = account.slice("Bridge:".length) as keyof BridgeLegs;
    if (!(key in bridge.legs)) return null;
    const value = bridge.legs[key];
    const legLabels: Record<keyof BridgeLegs, string> = {
      ebitdaEffect: "ΔEBITDA × Multiple(V1)",
      multipleEffect: "EBITDA(V2) × ΔMultiple",
      crossTerm: "ΔEBITDA × ΔMultiple",
      leverageEffect: "−ΔNetDebt",
      fxEffect: "FV × ΔFX",
      otherEffect: "Residual (normalization / adjustments)",
      total: "Total Δ = Σ legs",
    };
    return {
      value,
      currency: "EUR",
      provenance: [...basePR, synthRef],
      rule: `Bridge leg · ${legLabels[key]}`,
      derived: true,
    };
  }
  return null;
}

type EntityLevel = "total" | "group" | "project" | "entity";

export function entityLevelOf(entityId: string): EntityLevel {
  if (entityId === "PORTFOLIO_TOTAL") return "total";
  if (GROUPS_BY_ID[entityId]) return "group";
  if (PROJECTS_BY_ID[entityId]) return "project";
  if (ENTITIES_BY_ID[entityId]) return "entity";
  return "entity";
}

export function expandEntityToLeaves(entityId: string): string[] {
  if (entityId === "PORTFOLIO_TOTAL") return ENTITIES.map((e) => e.id);
  if (GROUPS_BY_ID[entityId]) {
    const projs = PROJECTS_BY_GROUP[entityId] ?? [];
    return projs.flatMap((p) => (ENTITIES_BY_PROJECT[p.id] ?? []).map((e) => e.id));
  }
  if (PROJECTS_BY_ID[entityId]) {
    return (ENTITIES_BY_PROJECT[entityId] ?? []).map((e) => e.id);
  }
  return [entityId];
}

export function parentEntityOf(entityId: string): string | null {
  if (entityId === "PORTFOLIO_TOTAL") return null;
  if (GROUPS_BY_ID[entityId]) return "PORTFOLIO_TOTAL";
  if (PROJECTS_BY_ID[entityId]) return PROJECTS_BY_ID[entityId].group;
  if (ENTITIES_BY_ID[entityId]) return ENTITIES_BY_ID[entityId].project;
  return null;
}

export function childEntitiesOf(entityId: string): string[] {
  if (entityId === "PORTFOLIO_TOTAL") return GROUPS.map((g) => g.id);
  if (GROUPS_BY_ID[entityId]) return (PROJECTS_BY_GROUP[entityId] ?? []).map((p) => p.id);
  if (PROJECTS_BY_ID[entityId]) return (ENTITIES_BY_PROJECT[entityId] ?? []).map((e) => e.id);
  return [];
}

// -------------------- Period expansion --------------------

export function expandPeriod(period: string): string[] {
  // Monthly: "YYYY-MM" — return as-is
  if (/^\d{4}-\d{2}$/.test(period)) return [period];
  // Quarterly: "YYYY-QN" — return 3 months
  const q = /^(\d{4})-Q([1-4])$/.exec(period);
  if (q) {
    const y = q[1];
    const qn = Number(q[2]);
    const startMonth = (qn - 1) * 3 + 1;
    return [0, 1, 2].map((i) => `${y}-${String(startMonth + i).padStart(2, "0")}`);
  }
  // YTD: "YTD-YYYY-MM" — return months 01..MM of year
  const ytd = /^YTD-(\d{4})-(\d{2})$/.exec(period);
  if (ytd) {
    const y = ytd[1];
    const end = Number(ytd[2]);
    return Array.from({ length: end }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
  }
  // Yearly: "YYYY" — return 12 months (but annual forecasts are stored as single "YYYY" cell; caller handles)
  if (/^\d{4}$/.test(period)) {
    const y = period;
    return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
  }
  return [period];
}

// -------------------- Indexing --------------------

function keyOf(entity: string, account: string, period: string, version: string, measure: string) {
  return `${entity}|${account}|${period}|${version}|${measure}`;
}

let indexCache: Map<string, LeafCell> | null = null;

function getIndex(): Map<string, LeafCell> {
  if (indexCache) return indexCache;
  const universe = getUniverse();
  const map = new Map<string, LeafCell>();
  for (const c of universe.cells) {
    map.set(keyOf(c.entity, c.account, c.period, c.version, c.measure), c);
  }
  indexCache = map;
  return map;
}

// -------------------- Account derivation rules --------------------

type DerivationFn = (
  sumByAccount: Record<string, number>
) => { value: number; deps: string[] } | null;

const RULES: Record<string, { expr: string; fn: DerivationFn; deps: string[] }> = {
  [ACCOUNT_DERIVED.Revenue]: {
    expr: "[Revenue_Product] + [Revenue_Services]",
    deps: [ACCOUNT_LEAVES.Revenue_Product, ACCOUNT_LEAVES.Revenue_Services],
    fn: (s) => ({
      value: (s[ACCOUNT_LEAVES.Revenue_Product] ?? 0) + (s[ACCOUNT_LEAVES.Revenue_Services] ?? 0),
      deps: [ACCOUNT_LEAVES.Revenue_Product, ACCOUNT_LEAVES.Revenue_Services],
    }),
  },
  [ACCOUNT_DERIVED.COGS]: {
    expr: "[COGS_Material] + [COGS_Labor]",
    deps: [ACCOUNT_LEAVES.COGS_Material, ACCOUNT_LEAVES.COGS_Labor],
    fn: (s) => ({
      value: (s[ACCOUNT_LEAVES.COGS_Material] ?? 0) + (s[ACCOUNT_LEAVES.COGS_Labor] ?? 0),
      deps: [ACCOUNT_LEAVES.COGS_Material, ACCOUNT_LEAVES.COGS_Labor],
    }),
  },
  [ACCOUNT_DERIVED.GrossProfit]: {
    expr: "[Revenue] − [COGS]",
    deps: [ACCOUNT_DERIVED.Revenue, ACCOUNT_DERIVED.COGS],
    fn: (s) => ({
      value: (s[ACCOUNT_DERIVED.Revenue] ?? 0) - (s[ACCOUNT_DERIVED.COGS] ?? 0),
      deps: [ACCOUNT_DERIVED.Revenue, ACCOUNT_DERIVED.COGS],
    }),
  },
  [ACCOUNT_DERIVED.OpEx]: {
    expr: "[OpEx_SG_A] + [OpEx_R_D] + [OpEx_Marketing]",
    deps: [ACCOUNT_LEAVES.OpEx_SG_A, ACCOUNT_LEAVES.OpEx_R_D, ACCOUNT_LEAVES.OpEx_Marketing],
    fn: (s) => ({
      value:
        (s[ACCOUNT_LEAVES.OpEx_SG_A] ?? 0) +
        (s[ACCOUNT_LEAVES.OpEx_R_D] ?? 0) +
        (s[ACCOUNT_LEAVES.OpEx_Marketing] ?? 0),
      deps: [ACCOUNT_LEAVES.OpEx_SG_A, ACCOUNT_LEAVES.OpEx_R_D, ACCOUNT_LEAVES.OpEx_Marketing],
    }),
  },
  [ACCOUNT_DERIVED.EBITDA]: {
    expr: "[GrossProfit] − [OpEx]",
    deps: [ACCOUNT_DERIVED.GrossProfit, ACCOUNT_DERIVED.OpEx],
    fn: (s) => ({
      value: (s[ACCOUNT_DERIVED.GrossProfit] ?? 0) - (s[ACCOUNT_DERIVED.OpEx] ?? 0),
      deps: [ACCOUNT_DERIVED.GrossProfit, ACCOUNT_DERIVED.OpEx],
    }),
  },
  [ACCOUNT_DERIVED.EBIT]: {
    expr: "[EBITDA] − [DA]",
    deps: [ACCOUNT_DERIVED.EBITDA, ACCOUNT_LEAVES.DA],
    fn: (s) => ({
      value: (s[ACCOUNT_DERIVED.EBITDA] ?? 0) - (s[ACCOUNT_LEAVES.DA] ?? 0),
      deps: [ACCOUNT_DERIVED.EBITDA, ACCOUNT_LEAVES.DA],
    }),
  },
  [ACCOUNT_DERIVED.NetIncome]: {
    expr: "[EBIT] − [Interest] − [Tax]",
    deps: [ACCOUNT_DERIVED.EBIT, ACCOUNT_LEAVES.Interest, ACCOUNT_LEAVES.Tax],
    fn: (s) => ({
      value:
        (s[ACCOUNT_DERIVED.EBIT] ?? 0) - (s[ACCOUNT_LEAVES.Interest] ?? 0) - (s[ACCOUNT_LEAVES.Tax] ?? 0),
      deps: [ACCOUNT_DERIVED.EBIT, ACCOUNT_LEAVES.Interest, ACCOUNT_LEAVES.Tax],
    }),
  },
  [ACCOUNT_DERIVED.GrossMarginPct]: {
    expr: "[GrossProfit] / [Revenue]",
    deps: [ACCOUNT_DERIVED.GrossProfit, ACCOUNT_DERIVED.Revenue],
    fn: (s) => {
      const rev = s[ACCOUNT_DERIVED.Revenue] ?? 0;
      if (!rev) return null;
      return {
        value: (s[ACCOUNT_DERIVED.GrossProfit] ?? 0) / rev,
        deps: [ACCOUNT_DERIVED.GrossProfit, ACCOUNT_DERIVED.Revenue],
      };
    },
  },
  [ACCOUNT_DERIVED.EBITDAMarginPct]: {
    expr: "[EBITDA] / [Revenue]",
    deps: [ACCOUNT_DERIVED.EBITDA, ACCOUNT_DERIVED.Revenue],
    fn: (s) => {
      const rev = s[ACCOUNT_DERIVED.Revenue] ?? 0;
      if (!rev) return null;
      return {
        value: (s[ACCOUNT_DERIVED.EBITDA] ?? 0) / rev,
        deps: [ACCOUNT_DERIVED.EBITDA, ACCOUNT_DERIVED.Revenue],
      };
    },
  },
  [ACCOUNT_DERIVED.TotalDebt]: {
    expr: "[ShortTermDebt] + [LongTermDebt]",
    deps: [ACCOUNT_LEAVES.ShortTermDebt, ACCOUNT_LEAVES.LongTermDebt],
    fn: (s) => ({
      value: (s[ACCOUNT_LEAVES.ShortTermDebt] ?? 0) + (s[ACCOUNT_LEAVES.LongTermDebt] ?? 0),
      deps: [ACCOUNT_LEAVES.ShortTermDebt, ACCOUNT_LEAVES.LongTermDebt],
    }),
  },
  [ACCOUNT_DERIVED.NetDebt]: {
    expr: "[TotalDebt] − [Cash]",
    deps: [ACCOUNT_DERIVED.TotalDebt, ACCOUNT_LEAVES.Cash],
    fn: (s) => ({
      value: (s[ACCOUNT_DERIVED.TotalDebt] ?? 0) - (s[ACCOUNT_LEAVES.Cash] ?? 0),
      deps: [ACCOUNT_DERIVED.TotalDebt, ACCOUNT_LEAVES.Cash],
    }),
  },
  [ACCOUNT_DERIVED.TotalAssets]: {
    expr: "[Cash] + [Receivables] + [Inventory] + [PPE] + [Goodwill]",
    deps: [
      ACCOUNT_LEAVES.Cash,
      ACCOUNT_LEAVES.Receivables,
      ACCOUNT_LEAVES.Inventory,
      ACCOUNT_LEAVES.PPE,
      ACCOUNT_LEAVES.Goodwill,
    ],
    fn: (s) => ({
      value:
        (s[ACCOUNT_LEAVES.Cash] ?? 0) +
        (s[ACCOUNT_LEAVES.Receivables] ?? 0) +
        (s[ACCOUNT_LEAVES.Inventory] ?? 0) +
        (s[ACCOUNT_LEAVES.PPE] ?? 0) +
        (s[ACCOUNT_LEAVES.Goodwill] ?? 0),
      deps: [
        ACCOUNT_LEAVES.Cash,
        ACCOUNT_LEAVES.Receivables,
        ACCOUNT_LEAVES.Inventory,
        ACCOUNT_LEAVES.PPE,
        ACCOUNT_LEAVES.Goodwill,
      ],
    }),
  },
  [ACCOUNT_DERIVED.WorkingCapital]: {
    expr: "[Receivables] + [Inventory] − [Payables]",
    deps: [ACCOUNT_LEAVES.Receivables, ACCOUNT_LEAVES.Inventory, ACCOUNT_LEAVES.Payables],
    fn: (s) => ({
      value:
        (s[ACCOUNT_LEAVES.Receivables] ?? 0) +
        (s[ACCOUNT_LEAVES.Inventory] ?? 0) -
        (s[ACCOUNT_LEAVES.Payables] ?? 0),
      deps: [ACCOUNT_LEAVES.Receivables, ACCOUNT_LEAVES.Inventory, ACCOUNT_LEAVES.Payables],
    }),
  },
  [ACCOUNT_DERIVED.FCF]: {
    expr: "[EBITDA] − [CapEx] − [Tax]",
    deps: [ACCOUNT_DERIVED.EBITDA, ACCOUNT_LEAVES.CapEx, ACCOUNT_LEAVES.Tax],
    fn: (s) => ({
      value:
        (s[ACCOUNT_DERIVED.EBITDA] ?? 0) - (s[ACCOUNT_LEAVES.CapEx] ?? 0) - (s[ACCOUNT_LEAVES.Tax] ?? 0),
      deps: [ACCOUNT_DERIVED.EBITDA, ACCOUNT_LEAVES.CapEx, ACCOUNT_LEAVES.Tax],
    }),
  },
};

export function isDerivedAccount(account: string): boolean {
  return account in RULES;
}

export function getRuleMeta(account: string): { expr: string; deps: string[] } | null {
  const r = RULES[account];
  return r ? { expr: r.expr, deps: r.deps } : null;
}

// -------------------- Core resolution --------------------

export interface ResolvedValue {
  value: number;
  currency: string;
  /** The leaf cells whose values contributed — the "provenance". */
  provenance: CellRef[];
  /** If this value was derived, the rule applied (human-readable). */
  rule?: string;
  /** True if the cell was assembled by aggregating children / deriving from a formula. */
  derived: boolean;
}

interface ResolveOpts {
  entity: string;
  account: string;
  period: string;
  version: VersionId;
  /** Target currency — "EUR" for reporting, or local. */
  currency?: string;
  measure?: string;
  cube?: "FIN_CUBE";
  /** Stack depth guard. */
  _depth?: number;
}

export function resolve(opts: ResolveOpts): ResolvedValue | null {
  const { entity, account, period, version } = opts;
  const measure = opts.measure ?? "Value";
  const targetCurrency = opts.currency ?? "EUR";
  const depth = opts._depth ?? 0;
  if (depth > 12) return null;

  // 0. Synthetic accounts tied to fair-value bridge — handled before the cube lookup
  //    so citations on FairValue / Bridge legs / Multiple resolve to real numbers.
  if (
    SYNTHETIC_ACCOUNTS.has(account) &&
    SYNTHETIC_VAL_VERSIONS.includes(version) &&
    targetCurrency === "EUR"
  ) {
    const out = resolveSynthetic(entity, account, version);
    if (out) return out;
  }
  // NetDebt at a Valuation version should also use the bridge snapshot (not the
  // cube's monthly Net Debt), so V1/V2 displays align with what the writer cited.
  if (account === ACCOUNT_DERIVED.NetDebt && SYNTHETIC_VAL_VERSIONS.includes(version)) {
    const bridge = getEntityBridge(entity);
    if (bridge) {
      const snap = version === VERSIONS.ValuationV1 ? bridge.v1 : bridge.v2;
      const ref: CellRef = {
        cube: "FIN_CUBE",
        entity,
        account,
        time: snap.period,
        version,
        currency: "EUR",
        measure: "Value",
      };
      return {
        value: snap.netDebt * snap.fx,
        currency: "EUR",
        provenance: [ref],
        rule: "NetDebt at valuation snapshot (from FV bridge)",
        derived: true,
      };
    }
  }

  // Annual forecast versions — period comes in as "YYYY"
  const annualVersions: string[] = [
    VERSIONS.MgmtForecastY1,
    VERSIONS.MgmtForecastY2,
    VERSIONS.MgmtForecastY3,
    VERSIONS.MgmtForecastY4,
    VERSIONS.PILForecastY1,
    VERSIONS.PILForecastY2,
    VERSIONS.PILForecastY3,
    VERSIONS.PILForecastY4,
  ];
  const isAnnualVersion = annualVersions.includes(version);

  // 1. Entity aggregation: if entity is not a leaf → sum over children
  const level = entityLevelOf(entity);
  if (level !== "entity") {
    const children = childEntitiesOf(entity);
    const provenance: CellRef[] = [];
    let total = 0;

    if (isDerivedAccount(account) && isMarginPct(account)) {
      // Margin %: need to recompute from numerator/denominator across children
      return resolveMarginPct({ ...opts, _depth: depth + 1 });
    }

    for (const child of children) {
      const r = resolve({ ...opts, entity: child, _depth: depth + 1 });
      if (!r) continue;
      total += r.value;
      provenance.push(...r.provenance);
    }
    return {
      value: total,
      currency: targetCurrency,
      provenance,
      rule: `Σ children of ${entity}`,
      derived: true,
    };
  }

  // 2. Entity leaf — check if account is derived
  if (isDerivedAccount(account)) {
    const rule = RULES[account];
    const sums: Record<string, number> = {};
    const provenance: CellRef[] = [];
    for (const dep of rule.deps) {
      const r = resolve({ ...opts, account: dep, _depth: depth + 1 });
      if (!r) continue;
      sums[dep] = r.value;
      provenance.push(...r.provenance);
    }
    const out = rule.fn(sums);
    if (!out) return null;
    return {
      value: out.value,
      currency: targetCurrency,
      provenance,
      rule: rule.expr,
      derived: true,
    };
  }

  // 3. Leaf account: aggregate across periods if period is quarterly/YTD/yearly
  const periods = isAnnualVersion && /^\d{4}$/.test(period) ? [period] : expandPeriod(period);
  if (periods.length > 1) {
    let total = 0;
    const provenance: CellRef[] = [];
    for (const p of periods) {
      const r = resolve({ ...opts, period: p, _depth: depth + 1 });
      if (!r) continue;
      total += r.value;
      provenance.push(...r.provenance);
    }
    return {
      value: total,
      currency: targetCurrency,
      provenance,
      rule: `Σ periods ${period}`,
      derived: true,
    };
  }

  // 4. Exact leaf cell
  const index = getIndex();
  const leafKey = keyOf(entity, account, periods[0], version, measure);
  const cell = index.get(leafKey);
  if (!cell) return null;

  // 5. FX translate if needed
  const fx =
    targetCurrency === cell.currency
      ? 1
      : targetCurrency === "EUR"
      ? FX_TO_EUR[cell.currency as keyof typeof FX_TO_EUR] ?? 1
      : 1 / (FX_TO_EUR[cell.currency as keyof typeof FX_TO_EUR] ?? 1);

  const ref: CellRef = {
    cube: "FIN_CUBE",
    entity: cell.entity,
    account: cell.account,
    time: cell.period,
    version: cell.version,
    currency: cell.currency,
    measure: cell.measure,
  };

  return {
    value: cell.value * fx,
    currency: targetCurrency,
    provenance: [ref],
    derived: false,
  };
}

function isMarginPct(account: string): boolean {
  return (
    account === ACCOUNT_DERIVED.GrossMarginPct ||
    account === ACCOUNT_DERIVED.EBITDAMarginPct
  );
}

function resolveMarginPct(opts: ResolveOpts): ResolvedValue | null {
  const numeratorAccount =
    opts.account === ACCOUNT_DERIVED.GrossMarginPct
      ? ACCOUNT_DERIVED.GrossProfit
      : ACCOUNT_DERIVED.EBITDA;
  const num = resolve({ ...opts, account: numeratorAccount, _depth: (opts._depth ?? 0) + 1 });
  const den = resolve({ ...opts, account: ACCOUNT_DERIVED.Revenue, _depth: (opts._depth ?? 0) + 1 });
  if (!num || !den || den.value === 0) return null;
  return {
    value: num.value / den.value,
    currency: opts.currency ?? "EUR",
    provenance: [...num.provenance, ...den.provenance],
    rule: `[${numeratorAccount}] / [Revenue]`,
    derived: true,
  };
}

// -------------------- High-level helpers --------------------

export function cellRefKey(ref: CellRef): string {
  return [
    ref.cube,
    ref.entity,
    ref.account,
    ref.time,
    ref.version,
    ref.currency,
    ref.measure,
    ref.valuationMethod ?? "",
  ].join("·");
}

export function encodeCellRef(ref: CellRef): string {
  return Buffer.from(JSON.stringify(ref), "utf-8").toString("base64url");
}

export function decodeCellRef(s: string): CellRef | null {
  try {
    return JSON.parse(Buffer.from(s, "base64url").toString("utf-8")) as CellRef;
  } catch {
    return null;
  }
}

export { entityProfile };
