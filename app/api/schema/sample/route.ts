import { NextResponse } from "next/server";
import { resolve } from "@/lib/jedox/engine";
import { buildEntityCatalog } from "@/lib/jedox/catalog";
import { DEMO_CURRENT_PERIOD } from "@/lib/jedox/time";
import type { VersionId } from "@/lib/jedox/schema";

export const runtime = "nodejs";

// A small live pivot for the Data Model page's "Sample Data" tab.
// Picks N entity-level tiles × {Actual, Budget-2026, Prior-Year Actual} and
// returns resolved values so users can see real numbers without leaving the
// data model page.
//
// Query params:
//   account=Revenue       (default: Revenue)
//   period=YTD-2026-03    (default: YTD-2026-03)
//   limit=6               (default: 6)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const account = url.searchParams.get("account") ?? "Revenue";
  const period = url.searchParams.get("period") ?? `YTD-${DEMO_CURRENT_PERIOD}`;
  const limit = Math.max(1, Math.min(24, Number(url.searchParams.get("limit") ?? "6")));

  const entities = buildEntityCatalog();
  const sampleEntities = entities.filter((e) => e.level === "entity").slice(0, limit);

  const versions: { id: VersionId; label: string }[] = [
    { id: "Actual", label: "Actual" },
    { id: "Budget-2026", label: "Budget 2026" },
  ];

  const rows = sampleEntities.map((e) => {
    const cells = versions.map((v) => {
      const r = resolve({
        entity: e.id,
        account,
        period,
        version: v.id,
        currency: "EUR",
      });
      return {
        version: v.id,
        label: v.label,
        value: r?.value ?? null,
      };
    });
    return {
      entityId: e.id,
      entityLabel: e.label,
      industry: e.industry ?? null,
      geography: e.geography ?? null,
      cells,
    };
  });

  return NextResponse.json({
    account,
    period,
    versions,
    rows,
  });
}
