import { NextResponse } from "next/server";
import { resolve, decodeCellRef, isDerivedAccount, getRuleMeta } from "@/lib/jedox/engine";
import type { VersionId } from "@/lib/jedox/schema";
import { monthIndexToPeriod, periodToMonthIndex } from "@/lib/jedox/time";
import { labelFor } from "@/lib/jedox/catalog";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ coord: string }> }) {
  const { coord } = await params;
  const ref = decodeCellRef(coord);
  if (!ref) return NextResponse.json({ error: "Invalid coord" }, { status: 400 });

  const r = resolve({
    entity: ref.entity,
    account: ref.account,
    period: ref.time,
    version: ref.version as VersionId,
    currency: ref.currency as "EUR",
    measure: ref.measure,
  });
  if (!r) return NextResponse.json({ error: "Cell not found" }, { status: 404 });

  // 12-month history around this period (for sparkline)
  const history: { period: string; value: number }[] = [];
  const mi = periodToMonthIndex(ref.time);
  if (mi !== null) {
    for (let offset = -11; offset <= 0; offset++) {
      const idx = mi + offset;
      if (idx < 0) continue;
      const p = monthIndexToPeriod(idx);
      const hr = resolve({
        entity: ref.entity,
        account: ref.account,
        period: p,
        version: ref.version as VersionId,
        currency: ref.currency as "EUR",
        measure: ref.measure,
      });
      if (hr) history.push({ period: p, value: hr.value });
    }
  }

  const ruleMeta = isDerivedAccount(ref.account) ? getRuleMeta(ref.account) : null;

  return NextResponse.json({
    coord: ref,
    value: r.value,
    currency: r.currency,
    derived: r.derived,
    rule: r.rule,
    provenance: r.provenance.slice(0, 24), // cap
    provenanceCount: r.provenance.length,
    history,
    labels: {
      entity: labelFor(ref.entity),
      account: labelFor(ref.account),
      version: labelFor(ref.version),
    },
    ruleMeta,
  });
}
