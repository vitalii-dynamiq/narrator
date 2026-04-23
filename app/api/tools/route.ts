import { NextResponse } from "next/server";
import { z } from "zod";
import { TOOLS } from "@/lib/agents/tools/registry";
import { ORCHESTRATOR_SYSTEM } from "@/lib/agents/orchestrator-prompt";
import { MODELS } from "@/lib/agents/anthropic";

export const runtime = "nodejs";

export async function GET() {
  const tools = TOOLS.map((t) => ({
    name: t.name,
    kind: "client" as const,
    description: t.description,
    spawnsAgent: t.spawnsAgent ?? false,
    jsonSchema: z.toJSONSchema(t.input_schema),
  }));
  // Anthropic-hosted server tool — declared to the API, executed on their infra.
  const serverTools = [
    {
      name: "code_execution",
      kind: "server" as const,
      description:
        "Python sandbox hosted on Anthropic (code_execution_20260120). REPL state persists across calls within a run. Pre-installed: pandas, numpy, matplotlib. Agent writes its own variance, bridge, decomposition, and materiality math here rather than calling fixed arithmetic tools.",
      spawnsAgent: false,
      jsonSchema: { type: "object", properties: { code: { type: "string" } }, required: ["code"] },
    },
  ];
  return NextResponse.json({
    agent: {
      id: "orchestrator",
      label: "UNITY Orchestrator",
      model: MODELS.OPUS,
      thinking: "adaptive (summarized)",
      system: ORCHESTRATOR_SYSTEM,
    },
    tools: [...tools, ...serverTools],
  });
}
