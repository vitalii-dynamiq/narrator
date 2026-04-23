// Variance calculations — the building blocks of commentary.
// Every variance struct carries enough provenance to cite back to the cube.

import { resolve, expandEntityToLeaves, childEntitiesOf } from "./engine";
import { ACCOUNT_DERIVED, type VersionId, type CellRef } from "./schema";
import { formatPeriodHuman } from "./time";

export type ComparisonBasis =
  | "vs_budget"
  | "vs_prior_year"
  | "vs_mgmt_forecast"
  | "vs_pil_forecast"
  | "pil_vs_mgmt"
  | "v2_vs_v1"
  | "mom"
  | "qoq";

export interface Comparison {
  basis: ComparisonBasis;
  label: string;
  periodA: string;
  versionA: VersionId;
  periodB: string;
  versionB: VersionId;
}

export interface VarianceRow {
  entity: string;
  entityLabel?: string;
  account: string;
  accountLabel?: string;
  basis: ComparisonBasis;
  basisLabel: string;
  periodLabel: string;
  valueA: number;
  valueB: number;
  delta: number;
  deltaPct: number | null;
  /** Significance score 0..1 — used by materiality filter. */
  significance: number;
  provenance: CellRef[];
}

export interface VarianceQuery {
  entity: string;
  accounts: string[];
  comparisons: Comparison[];
  /** If true, include the children of entity as separate rows as well. */
  includeChildren?: boolean;
  currency?: "EUR";
}

export function runVariance(q: VarianceQuery): VarianceRow[] {
  const currency = q.currency ?? "EUR";
  const rows: VarianceRow[] = [];
  const entities = q.includeChildren ? [q.entity, ...childEntitiesOf(q.entity)] : [q.entity];

  for (const entity of entities) {
    for (const account of q.accounts) {
      for (const cmp of q.comparisons) {
        const a = resolve({
          entity,
          account,
          period: cmp.periodA,
          version: cmp.versionA,
          currency,
        });
        const b = resolve({
          entity,
          account,
          period: cmp.periodB,
          version: cmp.versionB,
          currency,
        });
        if (!a || !b) continue;

        const delta = a.value - b.value;
        const deltaPct = b.value !== 0 ? delta / Math.abs(b.value) : null;
        const significance = computeSignificance(delta, b.value);

        rows.push({
          entity,
          account,
          basis: cmp.basis,
          basisLabel: cmp.label,
          periodLabel: formatPeriodHuman(cmp.periodA),
          valueA: a.value,
          valueB: b.value,
          delta,
          deltaPct,
          significance,
          provenance: [...a.provenance, ...b.provenance],
        });
      }
    }
  }
  return rows;
}

function computeSignificance(delta: number, base: number): number {
  if (base === 0) return Math.min(1, Math.abs(delta) / 1_000_000);
  const pct = Math.abs(delta) / Math.abs(base);
  const absM = Math.abs(delta) / 1_000_000;
  // Blend: 60% absolute €m (saturating at ~20M), 40% pct (saturating at 15%)
  const absScore = Math.min(1, absM / 20);
  const pctScore = Math.min(1, pct / 0.15);
  return 0.6 * absScore + 0.4 * pctScore;
}

export type MaterialityLevel = "entity" | "project" | "group" | "total";

export interface MaterialityThreshold {
  minAbsEur: number;
  minPct: number;
}

export const DEFAULT_MATERIALITY: Record<MaterialityLevel, MaterialityThreshold> = {
  entity: { minAbsEur: 100_000, minPct: 0.05 },
  project: { minAbsEur: 500_000, minPct: 0.03 },
  group: { minAbsEur: 2_000_000, minPct: 0.02 },
  total: { minAbsEur: 5_000_000, minPct: 0.015 },
};

export function applyMateriality(
  rows: VarianceRow[],
  level: MaterialityLevel,
  override?: Partial<MaterialityThreshold>
): { kept: VarianceRow[]; suppressed: VarianceRow[] } {
  const t = { ...DEFAULT_MATERIALITY[level], ...(override ?? {}) };
  const kept: VarianceRow[] = [];
  const suppressed: VarianceRow[] = [];
  for (const r of rows) {
    const absOk = Math.abs(r.delta) >= t.minAbsEur;
    const pctOk = r.deltaPct !== null && Math.abs(r.deltaPct) >= t.minPct;
    if (absOk || pctOk) kept.push(r);
    else suppressed.push(r);
  }
  return { kept, suppressed };
}

/** Decompose a parent variance into child contributions — the driver tree. */
export interface DriverContribution {
  entity: string;
  delta: number;
  deltaShare: number;
  valueA: number;
  valueB: number;
  provenance: CellRef[];
}

export function decomposeDrivers(params: {
  parentEntity: string;
  account: string;
  comparison: Comparison;
}): { total: DriverContribution; children: DriverContribution[] } {
  const children = childEntitiesOf(params.parentEntity);
  const parentA = resolve({
    entity: params.parentEntity,
    account: params.account,
    period: params.comparison.periodA,
    version: params.comparison.versionA,
    currency: "EUR",
  });
  const parentB = resolve({
    entity: params.parentEntity,
    account: params.account,
    period: params.comparison.periodB,
    version: params.comparison.versionB,
    currency: "EUR",
  });
  const parentDelta = (parentA?.value ?? 0) - (parentB?.value ?? 0);

  const contribs: DriverContribution[] = [];
  for (const child of children) {
    const a = resolve({
      entity: child,
      account: params.account,
      period: params.comparison.periodA,
      version: params.comparison.versionA,
      currency: "EUR",
    });
    const b = resolve({
      entity: child,
      account: params.account,
      period: params.comparison.periodB,
      version: params.comparison.versionB,
      currency: "EUR",
    });
    if (!a && !b) continue;
    const delta = (a?.value ?? 0) - (b?.value ?? 0);
    contribs.push({
      entity: child,
      delta,
      deltaShare: parentDelta !== 0 ? delta / parentDelta : 0,
      valueA: a?.value ?? 0,
      valueB: b?.value ?? 0,
      provenance: [...(a?.provenance ?? []), ...(b?.provenance ?? [])],
    });
  }
  // Sort by absolute contribution descending
  contribs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    total: {
      entity: params.parentEntity,
      delta: parentDelta,
      deltaShare: 1,
      valueA: parentA?.value ?? 0,
      valueB: parentB?.value ?? 0,
      provenance: [...(parentA?.provenance ?? []), ...(parentB?.provenance ?? [])],
    },
    children: contribs,
  };
}
