import { NextResponse } from "next/server";
import { computeEntityBridge } from "@/lib/jedox/valuation";
import { labelFor } from "@/lib/jedox/catalog";
import { childEntitiesOf, parentEntityOf } from "@/lib/jedox/engine";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bridge = computeEntityBridge(id);
  if (!bridge) return NextResponse.json({ error: "no bridge" }, { status: 404 });

  const children = childEntitiesOf(id).map((c) => {
    const b = computeEntityBridge(c);
    return b
      ? {
          id: c,
          label: labelFor(c),
          v1Fv: b.v1.fv,
          v2Fv: b.v2.fv,
          delta: b.legs.total,
          legs: b.legs,
        }
      : null;
  }).filter(Boolean);

  return NextResponse.json({
    entity: id,
    label: labelFor(id),
    bridge,
    parent: parentEntityOf(id),
    children,
  });
}
