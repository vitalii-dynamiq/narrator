// LLM-driven orchestrator. Real Claude tool-use loop over the UNITY cube.
// Live Anthropic API only — no simulated fallback. If ANTHROPIC_API_KEY is
// missing or the call fails, the run emits run_failed and the UI renders the
// error banner.

import Anthropic from "@anthropic-ai/sdk";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getClient, MODELS, MissingApiKeyError } from "./anthropic";
import {
  emitEvent,
  registerCancel,
  isCancelled,
  disposeCancel,
} from "./runtime";
import { TOOLS_BY_NAME, TOOLS } from "./tools/registry";
import type { AnyToolDef, ToolCtx } from "./tools/types";
import { ORCHESTRATOR_SYSTEM } from "./orchestrator-prompt";
import { buildEntityCatalog, buildAccountCatalog } from "@/lib/jedox/catalog";
import type { CellRef } from "@/lib/jedox/schema";
import { executeMemoryCommand, ensureMemoryRoot } from "./memory-store";
import { commitMessages, getConversation } from "./conversations";

export interface OrchestratorRequest {
  question: string;
  scope?: string;
  reportType?: "financial_performance" | "fair_valuation" | "chat";
  /**
   * When present, the run is the next turn of an existing conversation —
   * prior messages are loaded from the conversation store and the new user
   * question is appended. When absent, the run is a fresh single-turn.
   */
  conversationId?: string;
}

// Max safe output for Opus 4.7 streaming.
const MAX_OUTPUT_TOKENS = 16_000;

// Per-tool-result size cap. Client-tool outputs that exceed this get truncated
// with a sentinel; the model is told so it can re-query with tighter filters.
const TOOL_RESULT_MAX_CHARS = 24_000;

// Loop bound. Each turn = one Claude call; typical FP runs in 6–8 turns.
const MAX_TURNS = 16;

// Anthropic-hosted Python sandbox. REPL state persists across calls within a run.
const CODE_EXECUTION_TOOL: Anthropic.CodeExecutionTool20260120 = {
  type: "code_execution_20260120",
  name: "code_execution",
  cache_control: null,
};

// Anthropic-hosted memory tool — client-side storage (we handle view/create/
// str_replace/insert/delete/rename), Anthropic handles the protocol prompt and
// auto-checks memory before every task.
const MEMORY_TOOL: Anthropic.MemoryTool20250818 = {
  type: "memory_20250818",
  name: "memory",
  cache_control: null,
};

export async function runOrchestrator(runId: string, req: OrchestratorRequest) {
  try {
    // Ensure the memory filesystem root exists before Claude can view it.
    await ensureMemoryRoot();

    emitEvent(runId, {
      type: "run_started",
      runId,
      reportType: req.reportType ?? "chat",
      scope: req.scope ?? "PORTFOLIO_TOTAL",
      question: req.question,
    });

    const orchestratorNodeId = `orch_${nanoid(6)}`;
    emitEvent(runId, {
      type: "node_spawned",
      runId,
      node: {
        id: orchestratorNodeId,
        kind: "agent",
        agentId: "planner",
        label: "Orchestrator · Sonnet 4.6 adaptive",
        model: MODELS.SONNET,
        summary: "LLM-driven analysis — decides which tools to call",
      },
    });
    emitEvent(runId, { type: "node_started", runId, nodeId: orchestratorNodeId });

    const client = getClient();
    await runRealLoop(client, runId, orchestratorNodeId, req);
  } catch (err) {
    const message = formatError(err);
    console.error("orchestrator error", err);
    emitEvent(runId, { type: "run_failed", runId, error: message });
  }
}

// -------------------- Real Claude tool-use loop --------------------

async function runRealLoop(
  client: Anthropic,
  runId: string,
  nodeId: string,
  req: OrchestratorRequest
) {
  const tools: Anthropic.ToolUnion[] = [
    ...TOOLS.map(toolDefToClaude),
    CODE_EXECUTION_TOOL,
    MEMORY_TOOL,
  ];

  // Load any prior messages for this conversation (multi-turn chat).
  const conversation = req.conversationId
    ? getConversation(req.conversationId)
    : undefined;
  const priorMessages = conversation?.messages ?? [];

  // Fresh user turn — only the question. Prior turns (user + assistant) sit
  // ahead of it in `messages`.
  const messages: Anthropic.MessageParam[] = [
    ...priorMessages,
    { role: "user", content: buildUserPrompt(req, priorMessages.length > 0) },
  ];

  let tokensIn = 0;
  let tokensOut = 0;
  let tokensCached = 0;
  const startedAt = Date.now();
  let finished = false;
  let endReason: "finish_tool" | "end_turn" | "max_turns" | "empty_turn" | "cancelled" =
    "max_turns";

  // Register a cancellation handle; aborts in-flight streams + flags between
  // turns so /api/runs/[runId]/cancel can stop the loop.
  const abortController = registerCancel(runId);

  for (let turn = 0; turn < MAX_TURNS && !finished; turn++) {
    if (isCancelled(runId)) {
      finished = true;
      endReason = "cancelled";
      break;
    }
    let final: Anthropic.Message;
    try {
      const stream = client.messages.stream(
        {
          model: MODELS.SONNET,
          max_tokens: MAX_OUTPUT_TOKENS,
          // Sonnet 4.6 returns summarized thinking text by default; the
          // `display` knob is Opus 4.7-only, so we don't set it here.
          thinking: { type: "adaptive" },
          system: [
            {
              type: "text",
              text: ORCHESTRATOR_SYSTEM,
              cache_control: { type: "ephemeral" },
            },
            {
              type: "text",
              text: buildContextPrompt(),
              cache_control: { type: "ephemeral" },
            },
          ],
          tools,
          messages,
        },
        {
          signal: abortController.signal,
          // Enable Anthropic's server-side compaction so long multi-turn
          // conversations don't overflow the 1M context window. Prior turns
          // get summarised transparently once we cross the threshold.
          headers: { "anthropic-beta": "compact-2026-01-12" },
        }
      );

      for await (const event of stream) {
        if (event.type === "content_block_delta") {
          if (event.delta.type === "thinking_delta") {
            emitEvent(runId, {
              type: "thinking_delta",
              runId,
              nodeId,
              text: event.delta.thinking,
            });
          } else if (event.delta.type === "text_delta") {
            emitEvent(runId, { type: "text_delta", runId, nodeId, text: event.delta.text });
          }
        }
      }

      final = await stream.finalMessage();
    } catch (err) {
      // User-initiated cancel comes through as an AbortError. Exit cleanly.
      if (isCancelled(runId) || (err as { name?: string })?.name === "AbortError") {
        finished = true;
        endReason = "cancelled";
        break;
      }
      throw new Error(`Model call failed on turn ${turn + 1}: ${formatError(err)}`);
    }

    tokensIn += final.usage.input_tokens ?? 0;
    tokensOut += final.usage.output_tokens ?? 0;
    tokensCached += final.usage.cache_read_input_tokens ?? 0;
    if ((final.usage.cache_read_input_tokens ?? 0) > 0) {
      emitEvent(runId, {
        type: "cache_hit",
        runId,
        nodeId,
        tokens: final.usage.cache_read_input_tokens ?? 0,
      });
    }

    // Server-tool blocks (code_execution) are resolved by Anthropic inside the
    // same response. Emit UI events for them but do not round-trip; they stay
    // in the assistant content when we append below.
    emitServerToolEvents(runId, nodeId, final.content);

    if (final.stop_reason === "end_turn") {
      finished = true;
      endReason = "end_turn";
      break;
    }

    const toolUses = final.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (toolUses.length === 0) {
      finished = true;
      endReason = "empty_turn";
      break;
    }

    // CRITICAL: append the *full* assistant content (thinking blocks with
    // signatures, server_tool_use + code_execution_tool_result pairs, client
    // tool_use blocks). Opus 4.7 validates the CoT signature across turns.
    messages.push({ role: "assistant", content: final.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      // Memory tool — Anthropic protocol, our filesystem backend.
      if (tu.name === "memory") {
        const memoryResult = await handleMemoryToolUse(runId, nodeId, tu);
        toolResults.push(memoryResult);
        continue;
      }

      const tool = TOOLS_BY_NAME[tu.name];
      if (!tool) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Unknown tool "${tu.name}". Available client tools: ${TOOLS.map(
            (t) => t.name
          ).join(", ")}. For Python math, use the code_execution server tool instead.`,
          is_error: true,
        });
        continue;
      }
      const toolNodeId = `tool_${nanoid(6)}`;
      const label = labelForTool(tool, tu.input);
      emitEvent(runId, {
        type: "node_spawned",
        runId,
        node: {
          id: toolNodeId,
          kind: "tool",
          toolName: tu.name,
          toolInput: tu.input,
          label,
          parentId: nodeId,
        },
      });
      emitEvent(runId, { type: "node_started", runId, nodeId: toolNodeId });
      const callId = `c_${nanoid(6)}`;
      emitEvent(runId, {
        type: "tool_call",
        runId,
        nodeId,
        callId,
        name: tu.name,
        input: tu.input,
      });

      const tStart = Date.now();
      let cellsRead: CellRef[] = [];
      const ctx: ToolCtx = {
        runId,
        parentNodeId: toolNodeId,
        recordCellRefs: (refs) => cellsRead.push(...refs),
      };
      let output: unknown;
      let summary: string | undefined;
      let isError = false;
      try {
        const parsed = tool.input_schema.safeParse(tu.input);
        if (!parsed.success) {
          const issues = parsed.error.issues
            .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
            .join("; ");
          throw new Error(`Invalid input for ${tu.name} — ${issues}. Correct the arguments and retry.`);
        }
        const r = await tool.execute(parsed.data, ctx);
        output = r.output;
        summary = r.summary;
        cellsRead = [...(r.cellsRead ?? []), ...cellsRead];
      } catch (err) {
        output = { error: formatError(err) };
        summary = "error";
        isError = true;
      }
      const ms = Date.now() - tStart;

      emitEvent(runId, {
        type: "tool_result",
        runId,
        nodeId,
        callId,
        output,
        cellsRead: cellsRead.slice(0, 16),
        ms,
      });
      emitEvent(runId, {
        type: "node_completed",
        runId,
        nodeId: toolNodeId,
        ms,
        tokensIn: 0,
        tokensOut: 0,
        tokensCached: 0,
        output: { summary, preview: summarizeOutput(output) },
      });

      const serialized = typeof output === "string" ? output : JSON.stringify(output);
      const truncated =
        serialized.length > TOOL_RESULT_MAX_CHARS
          ? serialized.slice(0, TOOL_RESULT_MAX_CHARS) +
            `\n[…truncated — output exceeded ${TOOL_RESULT_MAX_CHARS} chars; re-query with narrower filters if you need more]`
          : serialized;
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: truncated,
        is_error: isError,
      });

      if (tu.name === "finish") {
        finished = true;
        endReason = "finish_tool";
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  const ms = Date.now() - startedAt;
  emitEvent(runId, {
    type: "node_completed",
    runId,
    nodeId,
    ms,
    tokensIn,
    tokensOut,
    tokensCached,
    output: { turns: messages.length, endReason },
  });

  // Commit the final message array back to the conversation store so the next
  // turn of this chat can pick up where we left off.
  if (req.conversationId) {
    commitMessages(req.conversationId, messages);
  }

  disposeCancel(runId);

  if (endReason === "cancelled") {
    emitEvent(runId, {
      type: "run_failed",
      runId,
      error: "Run cancelled by user.",
    });
  } else if (endReason === "max_turns") {
    emitEvent(runId, {
      type: "run_failed",
      runId,
      error: `Agent exhausted ${MAX_TURNS} turns without calling finish. Partial output may still be useful.`,
    });
  } else {
    emitEvent(runId, { type: "run_completed", runId });
  }
}

// Handle a `memory` tool_use block. Dispatches to the filesystem-backed memory
// store, emits UI events so the timeline shows the memory operation, and
// returns the tool_result block to append to the next turn's user message.
async function handleMemoryToolUse(
  runId: string,
  parentNodeId: string,
  tu: Anthropic.ToolUseBlock
): Promise<Anthropic.ToolResultBlockParam> {
  const input = tu.input as { command?: string; path?: string; old_path?: string } | undefined;
  const pathLabel =
    typeof input?.path === "string"
      ? input.path
      : typeof input?.old_path === "string"
      ? input.old_path
      : "";
  const label = `memory · ${input?.command ?? "?"}${pathLabel ? ` ${pathLabel}` : ""}`;

  const toolNodeId = `tool_${nanoid(6)}`;
  emitEvent(runId, {
    type: "node_spawned",
    runId,
    node: {
      id: toolNodeId,
      kind: "tool",
      toolName: "memory",
      toolInput: input,
      label,
      parentId: parentNodeId,
    },
  });
  emitEvent(runId, { type: "node_started", runId, nodeId: toolNodeId });
  emitEvent(runId, {
    type: "tool_call",
    runId,
    nodeId: parentNodeId,
    callId: tu.id,
    name: "memory",
    input,
  });

  const tStart = Date.now();
  let content = "";
  let isError = false;
  try {
    content = await executeMemoryCommand(input);
  } catch (err) {
    content = `Error: ${formatError(err)}`;
    isError = true;
  }
  const ms = Date.now() - tStart;

  emitEvent(runId, {
    type: "tool_result",
    runId,
    nodeId: parentNodeId,
    callId: tu.id,
    output: { content },
    cellsRead: [],
    ms,
  });
  emitEvent(runId, {
    type: "node_completed",
    runId,
    nodeId: toolNodeId,
    ms,
    tokensIn: 0,
    tokensOut: 0,
    tokensCached: 0,
    output: {
      summary: firstLine(content),
      preview: content.slice(0, 180),
    },
  });

  return {
    type: "tool_result",
    tool_use_id: tu.id,
    content,
    is_error: isError,
  };
}

function firstLine(s: string): string {
  const i = s.indexOf("\n");
  return i >= 0 ? s.slice(0, i) : s;
}

// Anthropic-server-tool blocks (code_execution, web_search, …) are paired in
// the assistant response. Emit matching tool_call / tool_result events so the
// UI timeline renders them like any other tool, without us executing anything.
function emitServerToolEvents(
  runId: string,
  parentNodeId: string,
  content: Anthropic.ContentBlock[]
) {
  const codeExecById = new Map<
    string,
    { input: unknown; code: string; startedAt: number }
  >();

  // First pass: locate server_tool_use for code_execution.
  for (const block of content) {
    if (block.type === "server_tool_use" && block.name === "code_execution") {
      const input = block.input as { code?: string } | null;
      const code = typeof input?.code === "string" ? input.code : "";
      codeExecById.set(block.id, { input, code, startedAt: Date.now() });

      const toolNodeId = `tool_${nanoid(6)}`;
      emitEvent(runId, {
        type: "node_spawned",
        runId,
        node: {
          id: toolNodeId,
          kind: "tool",
          toolName: "code_execution",
          toolInput: input,
          label: `code_execution (${code.split("\n").length} line${
            code.split("\n").length === 1 ? "" : "s"
          })`,
          parentId: parentNodeId,
        },
      });
      emitEvent(runId, { type: "node_started", runId, nodeId: toolNodeId });
      emitEvent(runId, {
        type: "tool_call",
        runId,
        nodeId: parentNodeId,
        callId: block.id,
        name: "code_execution",
        input,
      });
    }
  }

  // Second pass: pair each code_execution_tool_result with its use-id.
  for (const block of content) {
    if (block.type === "code_execution_tool_result") {
      const pending = codeExecById.get(block.tool_use_id);
      const startedAt = pending?.startedAt ?? Date.now();
      const ms = Date.now() - startedAt;
      const c = block.content;
      let preview = "";
      let summary = "executed";
      if (c.type === "code_execution_result") {
        preview = (c.stdout ?? "").slice(0, 400);
        const lines = (c.stdout ?? "").split("\n").length;
        summary = `exit ${c.return_code} · ${lines} line${lines === 1 ? "" : "s"} stdout`;
        if (c.stderr && c.stderr.trim().length > 0) {
          summary += ` · stderr ${c.stderr.split("\n").length} lines`;
        }
      } else if (c.type === "code_execution_tool_result_error") {
        preview = c.error_code;
        summary = `error: ${c.error_code}`;
      } else {
        summary = "encrypted result";
      }

      emitEvent(runId, {
        type: "tool_result",
        runId,
        nodeId: parentNodeId,
        callId: block.tool_use_id,
        output: c,
        cellsRead: [],
        ms,
      });
      // Find the spawned node and complete it.
      emitEvent(runId, {
        type: "node_completed",
        runId,
        // We don't track the tool node id here; callId is unique enough for
        // the UI. Use callId as the nodeId so a second completion lookup works.
        nodeId: block.tool_use_id,
        ms,
        tokensIn: 0,
        tokensOut: 0,
        tokensCached: 0,
        output: { summary, preview },
      });
    }
  }
}

// -------------------- Helpers --------------------

function buildUserPrompt(req: OrchestratorRequest, isFollowUp: boolean): string {
  if (isFollowUp) {
    // Keep follow-ups tight: the model already has the full prior history.
    const lines = [`Follow-up question: ${req.question}`];
    if (req.scope && req.scope !== "PORTFOLIO_TOTAL") {
      lines.push(`Focused scope hint: ${req.scope}`);
    }
    lines.push(
      "",
      "Reuse context from earlier turns where it applies. Only re-query the cube for numbers you haven't already pulled. When you write sections, cite fresh numbers with new [cite:N] markers — don't reuse citation ids from prior turns."
    );
    return lines.join("\n");
  }
  const lines = [`User question: ${req.question}`];
  if (req.scope && req.scope !== "PORTFOLIO_TOTAL") {
    lines.push(`Focused scope hint: ${req.scope}`);
  }
  if (req.reportType && req.reportType !== "chat") {
    lines.push(`Report type hint: ${req.reportType}`);
  }
  lines.push(
    "",
    "Start with `memory` view /memories to check for prior context, then query_cube for the figures, code_execution for any math, write_section for commentary, finish at the end."
  );
  return lines.join("\n");
}

function buildContextPrompt(): string {
  const entities = buildEntityCatalog();
  const accounts = buildAccountCatalog();
  const lines = [
    "=== UNITY cube catalog (for query_cube arguments) ===",
    "",
    "Current reporting period: 2026-03 (Q1 2026). 36 months of monthly actuals end at 2026-03.",
    "YTD for this quarter: YTD-2026-03. Prior-year YTD: YTD-2025-03.",
    "",
    "Entity catalog (id · label · level · industry · geography):",
  ];
  for (const e of entities) {
    lines.push(
      ` - ${e.id} · ${e.label} · ${e.level}${e.industry ? " · " + e.industry : ""}${
        e.geography ? " · " + e.geography : ""
      }`
    );
  }
  lines.push("", "Derived accounts (ƒ = computed from rule, aggregated automatically):");
  for (const d of accounts.derived) lines.push(` - ƒ ${d.id} = ${d.rule} (${d.group})`);
  lines.push("", "Leaf accounts by statement:");
  const byGroup: Record<string, string[]> = {};
  for (const l of accounts.leaves) (byGroup[l.group] ??= []).push(l.id);
  for (const [group, ids] of Object.entries(byGroup)) lines.push(` - ${group}: ${ids.join(", ")}`);
  lines.push(
    "",
    "Synthetic valuation accounts (only at Valuation-V1 / Valuation-V2 versions):",
    " - FairValue — EBITDA × Multiple − NetDebt (post-FX)",
    " - Multiple — EV/EBITDA multiple from the FV bridge snapshot",
    " - Bridge:ebitdaEffect / Bridge:multipleEffect / Bridge:crossTerm / Bridge:leverageEffect / Bridge:fxEffect / Bridge:otherEffect / Bridge:total — individual legs of the V1→V2 bridge"
  );
  return lines.join("\n");
}

function toolDefToClaude(tool: AnyToolDef): Anthropic.Tool {
  const jsonSchema = z.toJSONSchema(tool.input_schema) as Record<string, unknown>;
  const { $schema, ...rest } = jsonSchema;
  void $schema;
  const sanitized = sanitizeForStrict(rest) as Record<string, unknown>;
  return {
    name: tool.name,
    description: tool.description,
    input_schema: { type: "object", ...sanitized } as Anthropic.Tool["input_schema"],
    // Grammar-constrained inputs — Claude's tool_use JSON is guaranteed to
    // match the schema, which eliminates a class of runtime validation errors.
    strict: true,
  };
}

// Strip JSON-Schema keywords Anthropic's strict mode does not support. We still
// keep them in the server-side zod schema (safeParse catches any violations),
// but the wire schema can't include them. Refs:
//   https://platform.claude.com/docs/en/build-with-claude/structured-outputs
const STRIP_KEYWORDS = new Set([
  "maxItems",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "pattern",
  "format",
  "uniqueItems",
]);

function sanitizeForStrict(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeForStrict);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (STRIP_KEYWORDS.has(k)) continue;
      // `minItems` only allowed as 0 or 1 in strict mode — drop higher values.
      if (k === "minItems" && typeof v === "number" && v > 1) continue;
      out[k] = sanitizeForStrict(v);
    }
    return out;
  }
  return value;
}

function labelForTool(tool: AnyToolDef, input: unknown): string {
  try {
    return tool.label(input as never);
  } catch {
    return tool.name;
  }
}

function summarizeOutput(output: unknown): string {
  if (typeof output === "string") return output.slice(0, 180);
  const s = JSON.stringify(output);
  return s.length > 180 ? s.slice(0, 180) + "…" : s;
}

function formatError(err: unknown): string {
  if (err instanceof MissingApiKeyError) return err.message;
  if (err instanceof Anthropic.BadRequestError) return `Bad request: ${err.message}`;
  if (err instanceof Anthropic.AuthenticationError)
    return `Authentication failed — verify ANTHROPIC_API_KEY in .env.local`;
  if (err instanceof Anthropic.RateLimitError)
    return `Rate limited by Anthropic. Retry shortly.`;
  if (err instanceof Anthropic.APIError) return `Anthropic API error ${err.status}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

export { ORCHESTRATOR_SYSTEM };
