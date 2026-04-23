// SSE wire types shared between server and client.

import type { CellRef } from "@/lib/jedox/schema";

export type AgentId =
  | "planner"
  | "schema"
  | "retrieval"
  | "variance"
  | "materiality"
  | "drivers"
  | "bridge"
  | "insight"
  | "writer"
  | "citation"
  | "factcheck"
  | "composer";

export type AgentStatus = "pending" | "running" | "done" | "error";

export type ModelId = "claude-opus-4-7" | "claude-sonnet-4-6" | "claude-haiku-4-5";

export interface DAGNode {
  id: string; // unique node id within a run
  agentId: AgentId;
  label: string;
  model: ModelId;
  summary?: string;
}

export interface SectionCitation {
  id: number;
  entity: string;
  account: string;
  period: string;
  version: string;
  value: number;
}

export interface SectionDoc {
  id: string;
  title: string;
  body: string;
  citations: SectionCitation[];
  bullets?: string[];
  order: number;
}

export interface SpawnedNode {
  id: string;
  kind: "agent" | "tool";
  label: string;
  agentId?: AgentId;
  model?: ModelId;
  toolName?: string;
  toolInput?: unknown;
  parentId?: string;
  summary?: string;
}

export type RunEvent =
  | {
      type: "run_started";
      runId: string;
      reportType: string;
      scope: string;
      question?: string;
    }
  | { type: "dag_ready"; runId: string; nodes: DAGNode[]; edges: [string, string][] }
  | { type: "node_spawned"; runId: string; node: SpawnedNode }
  | { type: "edge_added"; runId: string; from: string; to: string }
  | { type: "node_started"; runId: string; nodeId: string }
  | { type: "thinking_delta"; runId: string; nodeId: string; text: string }
  | { type: "text_delta"; runId: string; nodeId: string; text: string }
  | { type: "tool_call"; runId: string; nodeId: string; callId: string; name: string; input: unknown }
  | {
      type: "tool_result";
      runId: string;
      nodeId: string;
      callId: string;
      output: unknown;
      cellsRead: CellRef[];
      ms: number;
    }
  | { type: "cache_hit"; runId: string; nodeId: string; tokens: number }
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
  | { type: "section_ready"; runId: string; section: SectionDoc }
  | { type: "run_completed"; runId: string; summary?: string }
  | { type: "run_failed"; runId: string; error: string };

// Client-side reduced state
export interface ToolCallState {
  callId: string;
  name: string;
  input: unknown;
  output?: unknown;
  cellsRead?: CellRef[];
  status: "running" | "done";
  startedAt: number;
  ms?: number;
}

export interface NodeState {
  id: string;
  kind: "agent" | "tool";
  agentId?: AgentId;
  toolName?: string;
  toolInput?: unknown;
  label: string;
  model?: ModelId;
  summary?: string;
  parentId?: string;
  status: AgentStatus;
  thinking: string;
  textDelta: string;
  toolCalls: ToolCallState[];
  output: unknown;
  tokensIn: number;
  tokensOut: number;
  tokensCached: number;
  startedAt: number | null;
  completedAt: number | null;
}

/**
 * Unified chronological trace entries: thinking prose and tool calls interleaved
 * in the order they happened, so the UI can render a single Claude-Desktop-style
 * timeline instead of two parallel widgets.
 */
export type TimelineEntry =
  | {
      kind: "thinking";
      id: string;
      /** Accumulated thinking text between tool calls. */
      text: string;
      startedAt: number;
    }
  | {
      kind: "tool";
      id: string;
      callId: string;
      name: string;
      input: unknown;
      output?: unknown;
      cellsRead?: CellRef[];
      ms?: number;
      status: "running" | "done";
      startedAt: number;
    };

export interface RunState {
  runId: string;
  status: "pending" | "running" | "completed" | "failed";
  error: string | null;
  nodes: Record<string, NodeState>;
  edges: [string, string][];
  sections: Record<string, SectionDoc>;
  timeline: TimelineEntry[];
  cacheTokens: number;
  inputTokens: number;
  outputTokens: number;
  startedAt: number;
  completedAt: number | null;
  dagReady: boolean;
}
