import { NextResponse } from "next/server";
import { getRunSnapshot } from "@/lib/agents/runtime";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshot = getRunSnapshot(id);
  if (!snapshot) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(snapshot);
}
