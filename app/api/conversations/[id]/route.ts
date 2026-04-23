import { NextResponse } from "next/server";
import { getConversation } from "@/lib/agents/conversations";

export const runtime = "nodejs";

/**
 * Thin rehydration endpoint. The client keeps the catalog (ChatEntry in
 * localStorage); this returns just enough to rebuild a chat view.
 *
 *   200 → { id, createdAt, updatedAt, turns: [{ runId, question, createdAt }] }
 *   410 → { error: "expired" }  (evicted by 6h TTL or process restart)
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const conv = getConversation(id);
  if (!conv) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }
  return NextResponse.json({
    id: conv.id,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    turns: conv.turns.map((t) => ({
      runId: t.runId,
      question: t.question,
      createdAt: t.createdAt,
    })),
  });
}
