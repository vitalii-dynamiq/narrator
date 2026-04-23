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
  fvChange: number; // fair value change
  aum: number; // proxy = revenue LTM
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
    aum: revenue * 4, // rough AUM proxy for tile sizing
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

  // Top contributors / detractors at the entity level
  const entityTiles = tiles.filter((t) => t.level === "entity");
  const byEbitdaVar = [...entityTiles].sort((a, b) => b.ebitdaVarBudget - a.ebitdaVarBudget);
  const contributors = byEbitdaVar.slice(0, 5);
  const detractors = byEbitdaVar.slice(-5).reverse();

  // Narrative insights — hand-crafted, rooted in the mock data stories
  const insights = [
    {
      agent: "Insight Discovery",
      entity: "ENT_VELA_SE",
      title: "Inflection detected in Vela SE — Nordic enterprise cohort",
      body:
        "Revenue +11.3% vs budget YTD after Swedish enterprise go-live in Oct 2025 (+18% ARR step-up); EBITDA +€0.95M over plan at 33.9% margin — above the 115% NDR thesis target.",
    },
    {
      agent: "Variance Analyst",
      entity: "ENT_FORTUNA_DE",
      title: "Fortuna DE — linerboard ASP compression bites",
      body:
        "Revenue −€10.3M (−9.0%) and EBITDA −€5.1M (−29%) vs Budget YTD; gross margin −340bps vs plan on DACH linerboard pricing, with volume deferral from a key auto-adjacent customer compounding.",
    },
    {
      agent: "Fair Valuation Bridge",
      entity: "ENT_ATLAS_NL",
      title: "Atlas NL — multiple expansion carries the FV story",
      body:
        "Logistics comp-set re-rated +1.5× EV/EBITDA over Q1; FV change driven almost entirely by multiple effect despite flat operating performance.",
    },
    {
      agent: "Driver Decomposition",
      entity: "ENT_HELIX_UK",
      title: "Helix UK returns to positive EBITDA growth",
      body:
        "First positive YoY EBITDA growth in 3 quarters, driven by the CMA-approved tuck-in closing January 2026; post-synergy margin lift of +140bps expected to annualize by Q3.",
    },
    {
      agent: "Insight Discovery",
      entity: "ENT_ORION_LYON",
      title: "Orion Lyon — €6.1M insurance recovery (one-off)",
      body:
        "Insurance recovery on the 2024 facility fire claim booked this quarter; flagged as one-off, excluded from run-rate fair valuation and LTM EBITDA bridges.",
    },
  ];

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
    insights,
  });
}
