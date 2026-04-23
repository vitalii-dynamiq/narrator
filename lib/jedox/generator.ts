// Deterministic seeded generator for the UNITY mock cube.
// Produces leaf-level cells only — aggregations and derivations are computed lazily.

import { hashSeed, mulberry32, randNormal } from "./seed";
import { ENTITIES, ENTITIES_BY_ID, type EntityFixture } from "./fixtures/portfolios";
import { INDUSTRY_PROFILES, FX_TO_EUR } from "./fixtures/industries";
import { SHOCKS_BY_ENTITY } from "./fixtures/shocks";
import {
  ACTUAL_PERIODS,
  BUDGET_2025_MONTHLY_PERIODS,
  BUDGET_2026_MONTHLY_PERIODS,
  FORWARD_YEARS,
  YTG_PERIODS,
  periodToMonthIndex,
} from "./time";
import { ACCOUNT_LEAVES, VERSIONS, type VersionId } from "./schema";

export const DEMO_SEED = "UNITY_DEMO_SEED_2026";

export interface LeafCell {
  entity: string; // leaf entity id
  account: string; // leaf account id
  period: string; // YYYY-MM or YYYY (annual forecasts)
  version: VersionId;
  currency: string; // local
  value: number; // in local currency
  measure: string; // "Value" | "FTE" | "Units" | "Pct"
}

interface EntityTrajectory {
  // Per-month series in local currency
  revenue: number[];
  grossMargin: number[]; // decimal
  opexRatio: number[]; // decimal — applied to revenue
  cogs: number[];
  opex: number[];
  oneOffGain: number[]; // additive below-the-line
  opexOneOff: number[]; // additive opex spike
  revenueProduct: number[]; // derived product-vs-services split
  revenueServices: number[];
  cogsMaterial: number[];
  cogsLabor: number[];
  opexSga: number[];
  opexRd: number[];
  opexMkt: number[];
  da: number[];
  interest: number[];
  tax: number[];
  ebitda: number[];
  // Balance sheet (month-end)
  cash: number[];
  receivables: number[];
  inventory: number[];
  ppe: number[];
  goodwill: number[];
  payables: number[];
  shortTermDebt: number[];
  longTermDebt: number[];
  equity: number[];
  // Cash flow
  cfOp: number[];
  cfInv: number[];
  cfFin: number[];
  capex: number[];
  // Operational
  headcount: number[];
  orders: number[];
  asp: number[];
  arr: number[];
}

export interface GeneratedUniverse {
  /** Map entity → trajectory (in local currency). Actuals only (36 months + YTG + forward annuals). */
  trajectories: Record<string, EntityTrajectory>;
  /** Flattened leaf cells for indexing. */
  cells: LeafCell[];
  /** Valuation snapshots per entity for Valuation-V1 and Valuation-V2. */
  valuations: Record<
    string,
    {
      v1: { period: string; ebitda: number; multiple: number; netDebt: number; fx: number; other: number; fv: number };
      v2: { period: string; ebitda: number; multiple: number; netDebt: number; fx: number; other: number; fv: number };
    }
  >;
}

// -------------------- core generator --------------------

function generateTrajectory(
  entity: EntityFixture,
  totalMonths: number,
  applyShocks: boolean
): EntityTrajectory {
  const profile = INDUSTRY_PROFILES[entity.industry];
  const rng = mulberry32(hashSeed(DEMO_SEED, entity.id));
  const shocks = applyShocks ? SHOCKS_BY_ENTITY[entity.id] ?? [] : [];

  const revenue = new Array(totalMonths).fill(0);
  const grossMargin = new Array(totalMonths).fill(0);
  const opexRatio = new Array(totalMonths).fill(0);
  const oneOffGain = new Array(totalMonths).fill(0);
  const opexOneOff = new Array(totalMonths).fill(0);

  const baseLocalMonthly = (entity.baseRevenueM * 1_000_000) / 12;
  const fxToEur = FX_TO_EUR[entity.localCurrency];
  const baseLocalMonth = baseLocalMonthly / fxToEur;

  // Noise memory for AR(1)
  let noise = 0;

  for (let i = 0; i < totalMonths; i++) {
    const yBucket = Math.min(2, Math.floor(i / 12));
    const cagr = yBucket === 0 ? profile.cagrY0 : yBucket === 1 ? profile.cagrY1 : profile.cagrY2;
    const monthsIntoCurve = i;
    const growth = Math.pow(1 + cagr, monthsIntoCurve / 12);
    const season = profile.seasonality[i % 12];
    const arBase = noise * 0.55 + randNormal(rng, 0, profile.revNoise);
    noise = arBase;
    revenue[i] = baseLocalMonth * growth * season * (1 + arBase);

    const yearsElapsed = i / 12;
    grossMargin[i] = profile.grossMarginStart + profile.grossMarginDrift * yearsElapsed;
    opexRatio[i] = Math.max(0.04, profile.opexRatioStart + profile.opexRatioDrift * yearsElapsed);
  }

  for (const shock of shocks) {
    const mi = shock.monthIndex;
    switch (shock.kind) {
      case "revenue_pct": {
        for (let i = mi; i < totalMonths; i++) revenue[i] *= 1 + shock.magnitude;
        break;
      }
      case "revenue_oneoff": {
        revenue[mi] += (shock.magnitude * 1_000_000) / fxToEur;
        break;
      }
      case "margin_bps": {
        const delta = shock.magnitude / 10_000;
        for (let i = mi; i < totalMonths; i++) grossMargin[i] += delta;
        break;
      }
      case "opex_oneoff": {
        opexOneOff[mi] += (shock.magnitude * 1_000_000) / fxToEur;
        break;
      }
      case "one_off_gain": {
        oneOffGain[mi] += (shock.magnitude * 1_000_000) / fxToEur;
        break;
      }
    }
  }

  // Derived monthly series
  const cogs = revenue.map((r, i) => r * (1 - grossMargin[i]));
  const opex = revenue.map((r, i) => r * opexRatio[i] + opexOneOff[i]);
  const da = revenue.map((r) => r * 0.035);
  const interest = revenue.map((r) => r * 0.012);
  const ebitda = revenue.map((r, i) => r - cogs[i] - opex[i] + oneOffGain[i]);
  const ebit = ebitda.map((e, i) => e - da[i]);
  const tax = ebit.map((eb) => Math.max(0, eb * 0.22));

  // Product vs Services split: SaaS/Fintech = 85/15, ProfServices = 10/90, others 65/35
  let productShare = 0.65;
  if (entity.industry === "SaaS" || entity.industry === "Fintech") productShare = 0.85;
  if (entity.industry === "ProfServices" || entity.industry === "HealthcareServices") productShare = 0.1;
  if (entity.industry === "DigitalHealth" || entity.industry === "Media" || entity.industry === "MediaTurnaround")
    productShare = 0.25;

  const revenueProduct = revenue.map((r) => r * productShare);
  const revenueServices = revenue.map((r) => r * (1 - productShare));

  // COGS split
  const cogsMaterial = cogs.map((c) => c * 0.62);
  const cogsLabor = cogs.map((c) => c * 0.38);

  // OpEx split: SGA ~55%, RD ~25% (sw-like) or 8% (other), Mktg ~ remainder
  const rdShare = ["SaaS", "Fintech", "DigitalHealth"].includes(entity.industry) ? 0.32 : 0.08;
  const opexSga = opex.map((o) => o * 0.55);
  const opexRd = opex.map((o) => o * rdShare);
  const opexMkt = opex.map((o, i) => Math.max(0, o - opexSga[i] - opexRd[i]));

  // Balance sheet — derive from revenue & working capital days
  const cash = new Array(totalMonths).fill(0);
  const receivables = revenue.map((r) => (r * profile.receivablesDays) / 30);
  const inventory = revenue.map((r) => (r * profile.inventoryDays) / 30);
  const payables = revenue.map((r) => (r * profile.payablesDays) / 30);
  const ppe = revenue.map((r, i) => r * (0.9 + 0.004 * i));
  const goodwill = revenue.map((_, i) =>
    (entity.baseRevenueM * 1_000_000 * (entity.industry === "SaaS" ? 2.8 : 1.4)) / fxToEur
  );

  // Debt — assume constant starting debt with seasonal flex, mild deleveraging
  const initialDebt = revenue[0] * 4.1;
  const shortTermDebt = revenue.map(() => initialDebt * 0.25);
  const longTermDebt = revenue.map((_, i) => initialDebt * (0.75 - 0.0015 * i));

  // Cash: start at initial stock, evolve by net cash flow
  const openingCash = revenue[0] * 2.2;
  const capex = revenue.map((r) => r * profile.capexRatio);
  const cfOp = revenue.map((_, i) => ebitda[i] - tax[i] - interest[i] - (i > 0 ? receivables[i] - receivables[i - 1] : 0));
  const cfInv = capex.map((c) => -c);
  const cfFin = new Array(totalMonths).fill(0);
  cash[0] = openingCash;
  for (let i = 1; i < totalMonths; i++) {
    cash[i] = Math.max(0, cash[i - 1] + cfOp[i] + cfInv[i] + cfFin[i]);
  }

  // Book equity is the accounting identity — Total Assets − Total Liabilities —
  // so the BS view reconciles: Cash + Receivables + Inventory + PPE + Goodwill
  // − Payables − ShortTermDebt − LongTermDebt = Equity.
  const equity = revenue.map(
    (_, i) =>
      cash[i] + receivables[i] + inventory[i] + ppe[i] + goodwill[i] -
      payables[i] - shortTermDebt[i] - longTermDebt[i]
  );

  // Operational
  const headcount = revenue.map((r) => Math.round((r * 12 * profile.fteDensity) / 1_000_000));
  const orders = revenue.map((r) => Math.round(r / 3500));
  const asp = revenue.map((r, i) => (orders[i] > 0 ? r / orders[i] : 0));
  const arr = revenue.map((r) => r * 12 * (entity.industry === "SaaS" || entity.industry === "Fintech" || entity.industry === "DigitalHealth" ? 1 : 0));

  return {
    revenue,
    grossMargin,
    opexRatio,
    cogs,
    opex,
    oneOffGain,
    opexOneOff,
    revenueProduct,
    revenueServices,
    cogsMaterial,
    cogsLabor,
    opexSga,
    opexRd,
    opexMkt,
    da,
    interest,
    tax,
    ebitda,
    cash,
    receivables,
    inventory,
    ppe,
    goodwill,
    payables,
    shortTermDebt,
    longTermDebt,
    equity,
    cfOp,
    cfInv,
    cfFin,
    capex,
    headcount,
    orders,
    asp,
    arr,
  };
}

// -------------------- Budget / Forecast scenarios --------------------

function bumpTrajectory(
  base: EntityTrajectory,
  revenueFactor: number,
  marginDeltaBps: number,
  opexDeltaRatio: number
): EntityTrajectory {
  const next: EntityTrajectory = JSON.parse(JSON.stringify(base));
  const n = base.revenue.length;
  const marginDelta = marginDeltaBps / 10_000;
  for (let i = 0; i < n; i++) {
    next.revenue[i] = base.revenue[i] * revenueFactor;
    next.grossMargin[i] = base.grossMargin[i] + marginDelta;
    next.opexRatio[i] = base.opexRatio[i] + opexDeltaRatio;
    next.cogs[i] = next.revenue[i] * (1 - next.grossMargin[i]);
    next.opex[i] = next.revenue[i] * next.opexRatio[i];
    next.ebitda[i] = next.revenue[i] - next.cogs[i] - next.opex[i];
    next.revenueProduct[i] = next.revenue[i] * (base.revenueProduct[i] / base.revenue[i] || 0);
    next.revenueServices[i] = next.revenue[i] - next.revenueProduct[i];
    next.cogsMaterial[i] = next.cogs[i] * 0.62;
    next.cogsLabor[i] = next.cogs[i] * 0.38;
    const rdShare = base.opexRd[i] / (base.opex[i] || 1);
    next.opexSga[i] = next.opex[i] * 0.55;
    next.opexRd[i] = next.opex[i] * rdShare;
    next.opexMkt[i] = Math.max(0, next.opex[i] - next.opexSga[i] - next.opexRd[i]);
  }
  return next;
}

// -------------------- Leaf cell emission --------------------

function pushLeafSeries(
  out: LeafCell[],
  entity: EntityFixture,
  version: VersionId,
  periods: string[],
  traj: EntityTrajectory,
  offset = 0
) {
  const series: Array<[string, number[]]> = [
    [ACCOUNT_LEAVES.Revenue_Product, traj.revenueProduct],
    [ACCOUNT_LEAVES.Revenue_Services, traj.revenueServices],
    [ACCOUNT_LEAVES.COGS_Material, traj.cogsMaterial],
    [ACCOUNT_LEAVES.COGS_Labor, traj.cogsLabor],
    [ACCOUNT_LEAVES.OpEx_SG_A, traj.opexSga],
    [ACCOUNT_LEAVES.OpEx_R_D, traj.opexRd],
    [ACCOUNT_LEAVES.OpEx_Marketing, traj.opexMkt],
    [ACCOUNT_LEAVES.DA, traj.da],
    [ACCOUNT_LEAVES.Interest, traj.interest],
    [ACCOUNT_LEAVES.Tax, traj.tax],
    [ACCOUNT_LEAVES.Cash, traj.cash],
    [ACCOUNT_LEAVES.Receivables, traj.receivables],
    [ACCOUNT_LEAVES.Inventory, traj.inventory],
    [ACCOUNT_LEAVES.PPE, traj.ppe],
    [ACCOUNT_LEAVES.Goodwill, traj.goodwill],
    [ACCOUNT_LEAVES.Payables, traj.payables],
    [ACCOUNT_LEAVES.ShortTermDebt, traj.shortTermDebt],
    [ACCOUNT_LEAVES.LongTermDebt, traj.longTermDebt],
    [ACCOUNT_LEAVES.Equity, traj.equity],
    [ACCOUNT_LEAVES.CF_Operating, traj.cfOp],
    [ACCOUNT_LEAVES.CF_Investing, traj.cfInv],
    [ACCOUNT_LEAVES.CF_Financing, traj.cfFin],
    [ACCOUNT_LEAVES.CapEx, traj.capex],
    [ACCOUNT_LEAVES.Headcount, traj.headcount],
    [ACCOUNT_LEAVES.Orders, traj.orders],
    [ACCOUNT_LEAVES.ASP, traj.asp],
    [ACCOUNT_LEAVES.ARR, traj.arr],
  ];

  for (const [acct, values] of series) {
    let measure: string = "Value";
    if (acct === ACCOUNT_LEAVES.Headcount) measure = "FTE";
    if (acct === ACCOUNT_LEAVES.Orders) measure = "Units";
    for (let p = 0; p < periods.length; p++) {
      const mi = offset + p;
      if (mi >= values.length) continue;
      out.push({
        entity: entity.id,
        account: acct,
        period: periods[p],
        version,
        currency: entity.localCurrency,
        measure,
        value: values[mi],
      });
    }
  }
}

function pushAnnualSeries(
  out: LeafCell[],
  entity: EntityFixture,
  version: VersionId,
  yearPeriods: string[],
  traj: EntityTrajectory,
  monthStart: number
) {
  // Aggregate 12 months starting at monthStart per year
  const aggregate = (values: number[]): number[] => {
    return yearPeriods.map((_, y) => {
      let sum = 0;
      for (let m = 0; m < 12; m++) {
        const idx = monthStart + y * 12 + m;
        if (idx < values.length) sum += values[idx];
      }
      return sum;
    });
  };

  const plSeries: Array<[string, number[]]> = [
    [ACCOUNT_LEAVES.Revenue_Product, aggregate(traj.revenueProduct)],
    [ACCOUNT_LEAVES.Revenue_Services, aggregate(traj.revenueServices)],
    [ACCOUNT_LEAVES.COGS_Material, aggregate(traj.cogsMaterial)],
    [ACCOUNT_LEAVES.COGS_Labor, aggregate(traj.cogsLabor)],
    [ACCOUNT_LEAVES.OpEx_SG_A, aggregate(traj.opexSga)],
    [ACCOUNT_LEAVES.OpEx_R_D, aggregate(traj.opexRd)],
    [ACCOUNT_LEAVES.OpEx_Marketing, aggregate(traj.opexMkt)],
    [ACCOUNT_LEAVES.DA, aggregate(traj.da)],
    [ACCOUNT_LEAVES.Interest, aggregate(traj.interest)],
    [ACCOUNT_LEAVES.Tax, aggregate(traj.tax)],
    [ACCOUNT_LEAVES.CapEx, aggregate(traj.capex)],
  ];

  for (const [acct, values] of plSeries) {
    for (let y = 0; y < yearPeriods.length; y++) {
      out.push({
        entity: entity.id,
        account: acct,
        period: yearPeriods[y],
        version,
        currency: entity.localCurrency,
        measure: "Value",
        value: values[y],
      });
    }
  }
}

// -------------------- Entry point --------------------

let cached: GeneratedUniverse | null = null;

export function getUniverse(): GeneratedUniverse {
  if (cached) return cached;

  const totalMonths = 36 + 9 + 12 * 4; // actuals + YTG + Y1..Y4 annual months
  const trajectories: Record<string, EntityTrajectory> = {};
  const cells: LeafCell[] = [];
  const valuations: GeneratedUniverse["valuations"] = {};

  for (const entity of ENTITIES) {
    const trajActual = generateTrajectory(entity, totalMonths, true);
    const trajBase = generateTrajectory(entity, totalMonths, false);
    trajectories[entity.id] = trajActual;

    // Actuals 0..35 — with shocks
    pushLeafSeries(cells, entity, VERSIONS.Actual as VersionId, ACTUAL_PERIODS, trajActual, 0);

    // Budget — derived from UNSHOCKED base trajectory (represents pre-shock expectations)
    const budget2025 = bumpTrajectory(trajBase, 1.03, 30, -0.005);
    pushLeafSeries(
      cells,
      entity,
      VERSIONS.Budget2025 as VersionId,
      BUDGET_2025_MONTHLY_PERIODS,
      budget2025,
      21
    );

    const budget2026 = bumpTrajectory(trajBase, 1.06, 40, -0.008);
    pushLeafSeries(
      cells,
      entity,
      VERSIONS.Budget2026 as VersionId,
      BUDGET_2026_MONTHLY_PERIODS,
      budget2026,
      33
    );

    // Mgmt YTG: optimistic extension of CURRENT run-rate (shocked trajectory ≈ actuals continuing)
    const mgmtYTG = bumpTrajectory(trajActual, 1.03, 15, -0.003);
    pushLeafSeries(cells, entity, VERSIONS.MgmtForecastYTG as VersionId, YTG_PERIODS, mgmtYTG, 36);

    // PIL YTG: conservative — vs trajActual (current run-rate) with cuts
    const isPILBullish =
      entity.id === "ENT_ATLAS_NL" || entity.id === "ENT_HELIX_UK" || entity.id === "ENT_VELA_SE";
    const rngBias = mulberry32(hashSeed(DEMO_SEED, entity.id, "pil"));
    const revCut = isPILBullish ? 0.04 + rngBias() * 0.04 : -(0.05 + rngBias() * 0.1);
    const marginBpsCut = isPILBullish ? 80 + rngBias() * 60 : -(50 + rngBias() * 100);
    const pilYTG = bumpTrajectory(trajActual, 1 + revCut, marginBpsCut, 0);
    pushLeafSeries(cells, entity, VERSIONS.PILForecastYTG as VersionId, YTG_PERIODS, pilYTG, 36);

    // Annual Y1..Y4 forecasts — use base trajectory (forward-looking growth curves)
    const mgmtFwd = bumpTrajectory(trajBase, 1.05, 30, -0.005);
    const pilFwd = bumpTrajectory(trajBase, 1 + revCut, marginBpsCut, 0);
    pushAnnualSeries(cells, entity, VERSIONS.MgmtForecastY1 as VersionId, ["2027"], mgmtFwd, 45);
    pushAnnualSeries(cells, entity, VERSIONS.MgmtForecastY2 as VersionId, ["2028"], mgmtFwd, 57);
    pushAnnualSeries(cells, entity, VERSIONS.MgmtForecastY3 as VersionId, ["2029"], mgmtFwd, 69);
    pushAnnualSeries(cells, entity, VERSIONS.MgmtForecastY4 as VersionId, ["2030"], mgmtFwd, 81);
    pushAnnualSeries(cells, entity, VERSIONS.PILForecastY1 as VersionId, ["2027"], pilFwd, 45);
    pushAnnualSeries(cells, entity, VERSIONS.PILForecastY2 as VersionId, ["2028"], pilFwd, 57);
    pushAnnualSeries(cells, entity, VERSIONS.PILForecastY3 as VersionId, ["2029"], pilFwd, 69);
    pushAnnualSeries(cells, entity, VERSIONS.PILForecastY4 as VersionId, ["2030"], pilFwd, 81);

    // Valuation snapshots — V1 at 2025-12 (month 32), V2 at 2026-03 (month 35)
    const ltmEBITDA = (startMonth: number) => {
      let s = 0;
      for (let i = startMonth - 11; i <= startMonth; i++) {
        if (i >= 0 && i < trajActual.ebitda.length) s += trajActual.ebitda[i];
      }
      return s;
    };
    const ebitdaV1 = ltmEBITDA(32);
    const ebitdaV2 = ltmEBITDA(35);
    const profile = INDUSTRY_PROFILES[entity.industry];
    const multipleV1 = profile.evEbitdaMultiple;
    let multipleV2 = multipleV1;
    if (entity.id === "ENT_ATLAS_NL") multipleV2 = multipleV1 + 1.5;
    else if (entity.id === "ENT_ATLAS_BE") multipleV2 = multipleV1 + 0.8;
    else multipleV2 = multipleV1 + (mulberry32(hashSeed(DEMO_SEED, entity.id, "mult"))() - 0.5) * 0.6;

    const netDebtV1 =
      trajActual.shortTermDebt[32] + trajActual.longTermDebt[32] - trajActual.cash[32];
    const netDebtV2 =
      trajActual.shortTermDebt[35] + trajActual.longTermDebt[35] - trajActual.cash[35];
    const fxV1 = fxNow(entity.localCurrency, 0);
    const fxV2 = fxNow(entity.localCurrency, 3); // small FX drift over a quarter

    const fvV1 = (ebitdaV1 * multipleV1 - netDebtV1) * fxV1;
    const fvV2 = (ebitdaV2 * multipleV2 - netDebtV2) * fxV2;

    valuations[entity.id] = {
      v1: {
        period: "2025-12",
        ebitda: ebitdaV1,
        multiple: multipleV1,
        netDebt: netDebtV1,
        fx: fxV1,
        other: 0,
        fv: fvV1,
      },
      v2: {
        period: "2026-03",
        ebitda: ebitdaV2,
        multiple: multipleV2,
        netDebt: netDebtV2,
        fx: fxV2,
        other: 0,
        fv: fvV2,
      },
    };
  }

  cached = { trajectories, cells, valuations };
  return cached;
}

function fxNow(currency: string, driftMonths: number): number {
  const base = FX_TO_EUR[currency as keyof typeof FX_TO_EUR] ?? 1;
  const rng = mulberry32(hashSeed(DEMO_SEED, currency, "fx", driftMonths));
  return base * (1 + (rng() - 0.5) * 0.01 * driftMonths);
}

/** Resolve an entity → its industry profile (for rules and valuation). */
export function entityProfile(entityId: string) {
  const e = ENTITIES_BY_ID[entityId];
  if (!e) return null;
  return {
    entity: e,
    profile: INDUSTRY_PROFILES[e.industry],
    fxToEur: FX_TO_EUR[e.localCurrency],
  };
}
