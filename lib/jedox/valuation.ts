// Fair Valuation bridge — decomposes V2 − V1 into additive effects.
// The identity:
//   V2 − V1 = ΔEBITDA · M1  +  EBITDA2 · ΔM  +  ΔEBITDA · ΔM  −  ΔNetDebt  +  ΔFX  +  ΔOther
// The canonical implementation lives in `./engine` (so it can be re-used by
// the synthetic-account resolver without a circular dep). This file keeps
// the public API stable.

import { getEntityBridge } from "./engine";
import { getUniverse } from "./generator";
import { ENTITIES_BY_ID } from "./fixtures/portfolios";

export interface ValuationBridge {
  entity: string;
  v1: {
    period: string;
    ebitda: number;
    multiple: number;
    netDebt: number;
    fx: number;
    fv: number;
  };
  v2: {
    period: string;
    ebitda: number;
    multiple: number;
    netDebt: number;
    fx: number;
    fv: number;
  };
  legs: {
    ebitdaEffect: number;
    multipleEffect: number;
    crossTerm: number;
    leverageEffect: number;
    fxEffect: number;
    otherEffect: number;
    total: number;
  };
  currency: "EUR";
}

export function computeEntityBridge(entityId: string): ValuationBridge | null {
  return getEntityBridge(entityId);
}

/** Aggregate portfolio-wide fair value at a version snapshot. */
export function portfolioFV(
  version: "v1" | "v2" = "v2"
): { total: number; byGroup: Record<string, number> } {
  const universe = getUniverse();
  let total = 0;
  const byGroup: Record<string, number> = {};
  for (const [entityId, v] of Object.entries(universe.valuations)) {
    const snap = v[version];
    total += snap.fv;
    const ent = ENTITIES_BY_ID[entityId];
    if (ent) byGroup[ent.group] = (byGroup[ent.group] ?? 0) + snap.fv;
  }
  return { total, byGroup };
}
