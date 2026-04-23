import { NextResponse } from "next/server";
import { buildAccountCatalog, buildEntityCatalog } from "@/lib/jedox/catalog";
import { CURRENCIES, MEASURES, VERSIONS } from "@/lib/jedox/schema";

export const runtime = "nodejs";

export async function GET() {
  const entities = buildEntityCatalog();
  const accounts = buildAccountCatalog();
  return NextResponse.json({
    cubes: [
      {
        id: "FIN_CUBE",
        label: "Financial Statements",
        dims: ["Entity", "Account", "Time", "Version", "Currency", "Measure"],
        description: "P&L, BS, CF, KPIs across Actuals, Budget, Mgmt Forecast, PIL Forecast",
      },
      {
        id: "VAL_CUBE",
        label: "Valuation",
        dims: ["Entity", "Time", "Version", "ValuationMethod", "Measure"],
        description: "Fair Value snapshots by method (Multiples / DCF / NAV) across versions",
      },
      {
        id: "META_CUBE",
        label: "Meta",
        dims: ["Entity", "Time", "Attribute"],
        description: "Headcount, ownership, normalization adjustments, acquisition dates",
      },
    ],
    dimensions: {
      Entity: { count: entities.length, hierarchies: ["primary", "Geography", "Industry"] },
      Account: {
        count: accounts.leaves.length + accounts.derived.length,
        hierarchies: ["PL", "BS", "CF", "KPI"],
      },
      Time: { count: 96, hierarchies: ["Year → Quarter → Month"] },
      Version: { count: Object.keys(VERSIONS).length, values: Object.values(VERSIONS) },
      Currency: { count: CURRENCIES.length, values: CURRENCIES },
      Measure: { count: MEASURES.length, values: MEASURES },
    },
    entities,
    accounts,
    rules: accounts.derived.map((d) => ({
      target: d.id,
      expr: d.rule,
      group: d.group,
    })),
  });
}
