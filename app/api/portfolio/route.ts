import { NextResponse } from "next/server";
import { resolve } from "@/lib/jedox/engine";
import { ACCOUNT_DERIVED, VERSIONS } from "@/lib/jedox/schema";
import { DEMO_CURRENT_PERIOD, monthIndexToPeriod } from "@/lib/jedox/time";
import {
  GROUPS,
  PROJECTS,
  ENTITIES,
  GROUPS_BY_ID,
  PROJECTS_BY_ID,
  ENTITIES_BY_ID,
} from "@/lib/jedox/fixtures/portfolios";
import { computeEntityBridge, portfolioFV } from "@/lib/jedox/valuation";
import { labelFor } from "@/lib/jedox/catalog";

export const runtime = "nodejs";

interface TileNode {
  id: string;
  label: string;
  level: "group" | "project" | "entity";
  parent?: string;
  revenueYtd: number;
  revenueBudget: number;
  revenuePy: number;
  ebitdaYtd: number;
  ebitdaBudget: number;
  ebitdaPy: number;
  marginPctCurrent: number;
  marginPctBudget: number;
  varianceBudgetPct: number; // revenue vs budget
  ebitdaVarBudget: number; // € delta
  fvChange: number; // fair value change (V2 − V1)
  aum: number; // fair value V2 (real, from bridge)
  sparkline: number[]; // 12m revenue series
}

function monthlyRevenueSeries(entity: string, months = 12): number[] {
  const out: number[] = [];
  for (let i = 12 - months; i < 12; i++) {
    const mi = 35 - (11 - i); // most recent 12 months
    const p = monthIndexToPeriod(mi);
    const r = resolve({
      entity,
      account: ACCOUNT_DERIVED.Revenue,
      period: p,
      version: VERSIONS.Actual,
      currency: "EUR",
    });
    out.push(r?.value ?? 0);
  }
  return out;
}

function buildTile(
  id: string,
  level: "group" | "project" | "entity",
  parent: string | undefined,
  label: string
): TileNode {
  const ytd = `YTD-${DEMO_CURRENT_PERIOD}`;
  const priorYtd = `YTD-2025-03`;
  const revenue = resolve({
    entity: id,
    account: ACCOUNT_DERIVED.Revenue,
    period: ytd,
    version: VERSIONS.Actual,
    currency: "EUR",
  })?.value ?? 0;
  const revenueBudget = resolve({
    entity: id,
    account: ACCOUNT_DERIVED.Revenue,
    period: ytd,
    version: VERSIONS.Budget2026,
    currency: "EUR",
  })?.value ?? 0;
  const revenuePy = resolve({
    entity: id,
    account: ACCOUNT_DERIVED.Revenue,
    period: priorYtd,
    version: VERSIONS.Actual,
    currency: "EUR",
  })?.value ?? 0;
  const ebitda = resolve({
    entity: id,
    account: ACCOUNT_DERIVED.EBITDA,
    period: ytd,
    version: VERSIONS.Actual,
    currency: "EUR",
  })?.value ?? 0;
  const ebitdaBudget = resolve({
    entity: id,
    account: ACCOUNT_DERIVED.EBITDA,
    period: ytd,
    version: VERSIONS.Budget2026,
    currency: "EUR",
  })?.value ?? 0;
  const ebitdaPy = resolve({
    entity: id,
    account: ACCOUNT_DERIVED.EBITDA,
    period: priorYtd,
    version: VERSIONS.Actual,
    currency: "EUR",
  })?.value ?? 0;
  const marginCurrent = revenue > 0 ? ebitda / revenue : 0;
  const marginBudget = revenueBudget > 0 ? ebitdaBudget / revenueBudget : 0;
  const varPct = revenueBudget > 0 ? (revenue - revenueBudget) / revenueBudget : 0;
  const bridge = computeEntityBridge(id);
  const fvChange = bridge?.legs.total ?? 0;
  // Real AUM = the current V2 fair value for this entity/project/group from
  // the valuation bridge. Falls back to a revenue proxy only if the bridge
  // isn't computable (shouldn't happen in the seeded data).
  const aum = bridge?.v2.fv ?? revenue * 4;

  return {
    id,
    label,
    level,
    parent,
    revenueYtd: revenue,
    revenueBudget,
    revenuePy,
    ebitdaYtd: ebitda,
    ebitdaBudget,
    ebitdaPy,
    marginPctCurrent: marginCurrent,
    marginPctBudget: marginBudget,
    varianceBudgetPct: varPct,
    ebitdaVarBudget: ebitda - ebitdaBudget,
    fvChange,
    aum,
    sparkline: monthlyRevenueSeries(id),
  };
}

export async function GET() {
  // Portfolio-wide hero KPIs
  const ytd = `YTD-${DEMO_CURRENT_PERIOD}`;
  const priorYtd = `YTD-2025-03`;
  const totalRevYtd = resolve({
    entity: "PORTFOLIO_TOTAL",
    account: ACCOUNT_DERIVED.Revenue,
    period: ytd,
    version: VERSIONS.Actual,
    currency: "EUR",
  })?.value ?? 0;
  const totalRevBud = resolve({
    entity: "PORTFOLIO_TOTAL",
    account: ACCOUNT_DERIVED.Revenue,
    period: ytd,
    version: VERSIONS.Budget2026,
    currency: "EUR",
  })?.value ?? 0;
  const totalEbitda = resolve({
    entity: "PORTFOLIO_TOTAL",
    account: ACCOUNT_DERIVED.EBITDA,
    period: ytd,
    version: VERSIONS.Actual,
    currency: "EUR",
  })?.value ?? 0;
  const totalEbitdaBud = resolve({
    entity: "PORTFOLIO_TOTAL",
    account: ACCOUNT_DERIVED.EBITDA,
    period: ytd,
    version: VERSIONS.Budget2026,
    currency: "EUR",
  })?.value ?? 0;
  const totalEbitdaPy = resolve({
    entity: "PORTFOLIO_TOTAL",
    account: ACCOUNT_DERIVED.EBITDA,
    period: priorYtd,
    version: VERSIONS.Actual,
    currency: "EUR",
  })?.value ?? 0;

  const fvSnapshot = portfolioFV("v2");
  const fvPrior = portfolioFV("v1");
  const fvChange = fvSnapshot.total - fvPrior.total;

  const tiles: TileNode[] = [];
  for (const g of GROUPS) tiles.push(buildTile(g.id, "group", "PORTFOLIO_TOTAL", g.label));
  for (const p of PROJECTS) tiles.push(buildTile(p.id, "project", p.group, p.label));
  for (const e of ENTITIES) tiles.push(buildTile(e.id, "entity", e.project, e.label));

  // Top contributors / detractors at the entity level.
  // Contributors = entities with genuinely positive EBITDA variance vs Budget
  // (never a "least-bad" negative entity mislabeled as a contributor).
  // Detractors = strictly negative variance. Capped at 5 per list.
  const entityTiles = tiles.filter((t) => t.level === "entity");
  const contributors = entityTiles
    .filter((t) => t.ebitdaVarBudget > 0)
    .sort((a, b) => b.ebitdaVarBudget - a.ebitdaVarBudget)
    .slice(0, 5);
  const detractors = entityTiles
    .filter((t) => t.ebitdaVarBudget < 0)
    .sort((a, b) => a.ebitdaVarBudget - b.ebitdaVarBudget)
    .slice(0, 5);

  return NextResponse.json({
    asOf: DEMO_CURRENT_PERIOD,
    hero: {
      aum: fvSnapshot.total,
      aumPrior: fvPrior.total,
      fvChange,
      totalRevenueYtd: totalRevYtd,
      totalRevenueBudget: totalRevBud,
      totalEbitdaYtd: totalEbitda,
      totalEbitdaBudget: totalEbitdaBud,
      totalEbitdaPy: totalEbitdaPy,
    },
    tiles,
    contributors,
    detractors,
  });
}
