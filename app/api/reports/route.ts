import { NextResponse } from "next/server";
import { createRun } from "@/lib/agents/runtime";
import { runOrchestrator, type OrchestratorRequest } from "@/lib/agents/orchestrator";
import { appendTurn, getOrCreate } from "@/lib/agents/conversations";

export const runtime = "nodejs";

interface Body {
  question?: string;
  scope?: string;
  reportType?: "financial_performance" | "fair_valuation" | "chat";
  materialityEur?: number;
  /**
   * When present, the new run continues an existing conversation — prior
   * turns' messages are loaded by the orchestrator. When absent, a new
   * conversation is created and its id is returned.
   */
  conversationId?: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body.question && !body.scope) {
    return NextResponse.json({ error: "question or scope required" }, { status: 400 });
  }

  const question =
    body.question ??
    (body.reportType === "fair_valuation"
      ? `Generate Fair Valuation Commentary for ${body.scope}. Walk the V2 − V1 bridge leg by leg and explain the drivers. Apply appropriate materiality.`
      : `Generate Financial Performance Commentary for ${body.scope}. Cover P&L variance vs Budget and vs Prior Year, highlight driver decomposition, and note any forecast divergence. Apply appropriate materiality.`);

  // Resolve or create the conversation BEFORE the run starts so we can return
  // the stable conversationId to the client immediately.
  const conversation = getOrCreate(body.conversationId);

  const request: OrchestratorRequest = {
    question,
    scope: body.scope,
    reportType: body.reportType ?? "chat",
    conversationId: conversation.id,
  };

  const runId = createRun({ request });
  appendTurn(conversation.id, runId, question);

  runOrchestrator(runId, request).catch((err) => {
    console.error("orchestrator error", err);
  });
  return NextResponse.json(
    { runId, conversationId: conversation.id },
    { status: 202 }
  );
}
