import { NextResponse } from "next/server";
import { cancelRun } from "@/lib/agents/runtime";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const cancelled = cancelRun(id);
  return NextResponse.json({ cancelled, runId: id });
}
