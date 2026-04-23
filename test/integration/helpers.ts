// Integration test harness — drives live Anthropic runs through the real
// `/api/reports` endpoint and parses the SSE stream into typed events.

import { createParser, type EventSourceMessage } from "eventsource-parser";

const BASE_URL = process.env.UNITY_BASE_URL ?? "http://localhost:7340";

// Event shapes emitted by the orchestrator. Kept loose (`unknown` on payloads
// we don't assert against) so the helpers don't have to pull in the full
// types from lib/agents/events.
export type RunEvent =
  | {
      type: "run_started";
      runId: string;
      reportType: string;
      scope: string;
      question?: string;
    }
  | { type: "node_started"; runId: string; nodeId: string }
  | {
      type: "node_spawned";
      runId: string;
      node: {
        id: string;
        kind: "agent" | "tool";
        label: string;
        toolName?: string;
        toolInput?: unknown;
      };
    }
  | {
      type: "tool_call";
      runId: string;
      nodeId: string;
      callId: string;
      name: string;
      input: unknown;
    }
  | {
      type: "tool_result";
      runId: string;
      nodeId: string;
      callId: string;
      output: unknown;
      ms: number;
    }
  | { type: "thinking_delta"; runId: string; nodeId: string; text: string }
  | { type: "text_delta"; runId: string; nodeId: string; text: string }
  | { type: "cache_hit"; runId: string; nodeId: string; tokens: number }
  | {
      type: "section_ready";
      runId: string;
      section: {
        id: string;
        title: string;
        body: string;
        citations: Array<{
          id: number;
          entity: string;
          account: string;
          period: string;
          version: string;
          value: number;
        }>;
        order: number;
      };
    }
  | {
      type: "node_completed";
      runId: string;
      nodeId: string;
      ms: number;
      tokensIn: number;
      tokensOut: number;
      tokensCached: number;
      output: unknown;
    }
  | { type: "run_completed"; runId: string; summary?: string }
  | { type: "run_failed"; runId: string; error: string };

export interface StartRunOptions {
  scope?: string;
  reportType?: "financial_performance" | "fair_valuation" | "chat";
  conversationId?: string;
}

export interface RunSession {
  runId: string;
  conversationId: string;
  events: RunEvent[];
  /**
   * Shorthand accessors populated as events stream in.
   */
  sections: Array<Extract<RunEvent, { type: "section_ready" }>["section"]>;
  toolCalls: Array<Extract<RunEvent, { type: "tool_call" }>>;
  serverToolUses: string[]; // names of server tools Claude invoked
  finalStatus: "completed" | "failed" | "in_progress";
  failureError: string | null;
}

/**
 * POST to `/api/reports`, open the SSE stream, and drain events until a
 * terminal (`run_completed` or `run_failed`) is seen. Returns the full session
 * for assertion.
 */
export async function runToCompletion(
  question: string,
  opts: StartRunOptions = {}
): Promise<RunSession> {
  const body: Record<string, unknown> = {
    question,
    reportType: opts.reportType ?? "chat",
  };
  if (opts.scope) body.scope = opts.scope;
  if (opts.conversationId) body.conversationId = opts.conversationId;

  const startResp = await fetch(`${BASE_URL}/api/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!startResp.ok) {
    throw new Error(
      `/api/reports returned ${startResp.status}: ${await startResp.text()}`
    );
  }
  const { runId, conversationId } = (await startResp.json()) as {
    runId: string;
    conversationId: string;
  };

  const session: RunSession = {
    runId,
    conversationId,
    events: [],
    sections: [],
    toolCalls: [],
    serverToolUses: [],
    finalStatus: "in_progress",
    failureError: null,
  };

  const streamResp = await fetch(`${BASE_URL}/api/runs/${runId}/events`);
  if (!streamResp.ok || !streamResp.body) {
    throw new Error(
      `SSE stream error ${streamResp.status}: ${await streamResp.text()}`
    );
  }

  const parser = createParser({
    onEvent(msg: EventSourceMessage) {
      if (!msg.data) return;
      try {
        const ev = JSON.parse(msg.data) as RunEvent;
        session.events.push(ev);
        if (ev.type === "section_ready") session.sections.push(ev.section);
        if (ev.type === "tool_call") session.toolCalls.push(ev);
        if (ev.type === "run_completed") session.finalStatus = "completed";
        if (ev.type === "run_failed") {
          session.finalStatus = "failed";
          session.failureError = ev.error;
        }
      } catch {
        // Silently skip malformed events — the stream occasionally carries
        // keep-alive comments that shouldn't fail the test.
      }
    },
  });

  const reader = streamResp.body.getReader();
  const decoder = new TextDecoder();
  while (session.finalStatus === "in_progress") {
    const { value, done } = await reader.read();
    if (done) break;
    parser.feed(decoder.decode(value, { stream: true }));
  }
  try {
    await reader.cancel();
  } catch {
    /* ignore */
  }
  return session;
}

/**
 * Fetch the cell-inspector endpoint for a citation and assert the cube's
 * canonical value matches the cited value within 1%.
 */
export async function assertCitationResolves(cite: {
  entity: string;
  account: string;
  period: string;
  version: string;
  value: number;
}): Promise<{ coord: string; serverValue: number; ok: boolean }> {
  const ref = {
    cube: "FIN_CUBE",
    entity: cite.entity,
    account: cite.account,
    time: cite.period,
    version: cite.version,
    currency: "EUR",
    measure: "Value",
  };
  const coord = Buffer.from(JSON.stringify(ref), "utf8").toString("base64url");
  const r = await fetch(`${BASE_URL}/api/cubes/FIN_CUBE/cells/${coord}`);
  if (!r.ok) {
    return { coord, serverValue: 0, ok: false };
  }
  const d = (await r.json()) as { value: number };
  const server = d.value;
  const tolerance = Math.max(Math.abs(server) * 0.01, 1);
  const ok = Math.abs(cite.value - server) <= tolerance;
  return { coord, serverValue: server, ok };
}

/**
 * Quick boot-up health check. Skips the suite cleanly when the dev server
 * isn't running.
 */
export async function pingServer(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE_URL}/`, { method: "HEAD" });
    return r.ok || r.status === 405;
  } catch {
    return false;
  }
}
