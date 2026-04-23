import { NextResponse } from "next/server";
import { decomposeDrivers, type Comparison } from "@/lib/jedox/variance";
import { childEntitiesOf, parentEntityOf } from "@/lib/jedox/engine";
import { labelFor } from "@/lib/jedox/catalog";
import { ACCOUNT_DERIVED, VERSIONS } from "@/lib/jedox/schema";
import { DEMO_CURRENT_PERIOD } from "@/lib/jedox/time";

export const runtime = "nodejs";

const BASIS_MAP: Record<string, () => Comparison> = {
  vs_budget: () => ({
    basis: "vs_budget",
    label: "vs Budget YTD",
    periodA: `YTD-${DEMO_CURRENT_PERIOD}`,
    versionA: VERSIONS.Actual,
    periodB: `YTD-${DEMO_CURRENT_PERIOD}`,
    versionB: VERSIONS.Budget2026,
  }),
  vs_prior_year: () => ({
    basis: "vs_prior_year",
    label: "vs Prior Year",
    periodA: `YTD-${DEMO_CURRENT_PERIOD}`,
    versionA: VERSIONS.Actual,
    periodB: "YTD-2025-03",
    versionB: VERSIONS.Actual,
  }),
  vs_mgmt_forecast: () => ({
    basis: "vs_mgmt_forecast",
    label: "vs Mgmt Forecast",
    periodA: `YTD-${DEMO_CURRENT_PERIOD}`,
    versionA: VERSIONS.Actual,
    periodB: `YTD-${DEMO_CURRENT_PERIOD}`,
    versionB: VERSIONS.MgmtForecastYTG,
  }),
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const rawAccount = url.searchParams.get("account") ?? "EBITDA";
  const rawBasis = url.searchParams.get("basis") ?? "vs_budget";
  const allowedAccounts: string[] = [
    ACCOUNT_DERIVED.EBITDA,
    ACCOUNT_DERIVED.Revenue,
    ACCOUNT_DERIVED.GrossProfit,
    ACCOUNT_DERIVED.NetDebt,
  ];
  const account = allowedAccounts.includes(rawAccount) ? rawAccount : ACCOUNT_DERIVED.EBITDA;
  const basisBuilder = BASIS_MAP[rawBasis] ?? BASIS_MAP.vs_budget;

  const tree = decomposeDrivers({
    parentEntity: id,
    account,
    comparison: basisBuilder(),
  });

  return NextResponse.json({
    parent: {
      id: tree.total.entity,
      label: labelFor(tree.total.entity),
      account,
      basis: rawBasis,
      delta: tree.total.delta,
      valueA: tree.total.valueA,
      valueB: tree.total.valueB,
    },
    children: tree.children.map((c) => ({
      id: c.entity,
      label: labelFor(c.entity),
      delta: c.delta,
      deltaShare: c.deltaShare,
      valueA: c.valueA,
      valueB: c.valueB,
      hasChildren: childEntitiesOf(c.entity).length > 0,
    })),
    parentAncestor: parentEntityOf(id),
  });
}
