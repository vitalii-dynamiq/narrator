import { NextResponse } from "next/server";
import {
  ENTITIES_BY_ID,
  GROUPS_BY_ID,
  PROJECTS_BY_ID,
} from "@/lib/jedox/fixtures/portfolios";
import { childEntitiesOf, parentEntityOf, expandEntityToLeaves, resolve } from "@/lib/jedox/engine";
import { ACCOUNT_DERIVED, VERSIONS } from "@/lib/jedox/schema";
import { DEMO_CURRENT_PERIOD, monthIndexToPeriod } from "@/lib/jedox/time";
import { labelFor } from "@/lib/jedox/catalog";
import { computeEntityBridge } from "@/lib/jedox/valuation";

export const runtime = "nodejs";

function buildMetadata(level: string, id: string) {
  if (level === "entity") {
    const e = ENTITIES_BY_ID[id];
    if (!e) return undefined;
    return {
      industry: e.industry,
      geography: e.geography,
      currency: e.localCurrency,
      baseRevenueM: e.baseRevenueM,
      ownershipPct: e.ownershipPct,
      flavor: e.flavor,
    };
  }
  if (level === "project") {
    const p = PROJECTS_BY_ID[id];
    if (!p) return undefined;
    return {
      industry: p.industry,
      geography: p.geography,
      thesis: p.thesis,
      acquiredYear: p.acquiredYear,
    };
  }
  if (level === "group") {
    const g = GROUPS_BY_ID[id];
    if (!g) return undefined;
    return {
      aumEurM: g.aumEurM,
      mandate: g.mandate,
    };
  }
  return undefined;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const level = GROUPS_BY_ID[id]
    ? "group"
    : PROJECTS_BY_ID[id]
    ? "project"
    : ENTITIES_BY_ID[id]
    ? "entity"
    : id === "PORTFOLIO_TOTAL"
    ? "total"
    : "entity";

  const label = labelFor(id);

  const ancestors: { id: string; label: string; level: string }[] = [];
  let p = parentEntityOf(id);
  while (p) {
    const l = GROUPS_BY_ID[p]
      ? "group"
      : PROJECTS_BY_ID[p]
      ? "project"
      : p === "PORTFOLIO_TOTAL"
      ? "total"
      : "entity";
    ancestors.unshift({ id: p, label: labelFor(p), level: l });
    p = parentEntityOf(p);
  }

  // Current-period snapshot KPIs
  const currentYTD = `YTD-${DEMO_CURRENT_PERIOD}`;
  const priorYTD = `YTD-${Number(DEMO_CURRENT_PERIOD.slice(0, 4)) - 1}-${DEMO_CURRENT_PERIOD.slice(5)}`;
  const kpis = [
    { key: "Revenue", label: "Revenue YTD", account: ACCOUNT_DERIVED.Revenue },
    { key: "EBITDA", label: "EBITDA YTD", account: ACCOUNT_DERIVED.EBITDA },
    { key: "EBITDAMarginPct", label: "EBITDA Margin", account: ACCOUNT_DERIVED.EBITDAMarginPct },
    { key: "NetDebt", label: "Net Debt", account: ACCOUNT_DERIVED.NetDebt },
  ];
  const snapshot: Record<string, { actual: number | null; budget: number | null; pyActual: number | null; deltaBudget: number | null; deltaYoY: number | null; unit: "eur" | "pct" }> = {};
  for (const k of kpis) {
    const isPct = k.account === ACCOUNT_DERIVED.EBITDAMarginPct;
    const isBS = k.account === ACCOUNT_DERIVED.NetDebt;
    const periodForActual = isBS ? DEMO_CURRENT_PERIOD : currentYTD;
    const a = resolve({
      entity: id,
      account: k.account,
      period: periodForActual,
      version: VERSIONS.Actual,
      currency: "EUR",
    });
    const budget = resolve({
      entity: id,
      account: k.account,
      period: periodForActual,
      version: VERSIONS.Budget2026,
      currency: "EUR",
    });
    const pyActual = resolve({
      entity: id,
      account: k.account,
      period: isBS ? monthIndexToPeriod(35 - 12) : priorYTD,
      version: VERSIONS.Actual,
      currency: "EUR",
    });
    snapshot[k.key] = {
      actual: a?.value ?? null,
      budget: budget?.value ?? null,
      pyActual: pyActual?.value ?? null,
      deltaBudget: a && budget ? a.value - budget.value : null,
      deltaYoY: a && pyActual ? a.value - pyActual.value : null,
      unit: isPct ? "pct" : "eur",
    };
  }

  // Fair Valuation bridge preview
  const bridge = computeEntityBridge(id);
  const fvCurrent = bridge?.v2.fv ?? null;
  const fvChange = bridge?.legs.total ?? null;

  return NextResponse.json({
    id,
    label,
    level,
    ancestors,
    children: childEntitiesOf(id).map((c) => ({ id: c, label: labelFor(c) })),
    leafCount: expandEntityToLeaves(id).length,
    metadata: buildMetadata(level, id),
    kpis: snapshot,
    valuation: {
      fvCurrent,
      fvChange,
      v1: bridge?.v1 ?? null,
      v2: bridge?.v2 ?? null,
      legs: bridge?.legs ?? null,
    },
  });
}
