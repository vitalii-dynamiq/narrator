// Shared types for the tool library.
// Every tool is a zod-typed function with a stable schema the Claude SDK can render.

import type { z } from "zod";
import type { CellRef } from "@/lib/jedox/schema";

export interface ToolDef<I = unknown, O = unknown> {
  name: string;
  description: string;
  /** Zod schema for the tool's inputs — rendered to JSON Schema for the Claude API. */
  input_schema: z.ZodType<I>;
  /** Short single-line human label for the DAG node. */
  label: (input: I) => string;
  /** Execute the tool. `ctx` lets executors mutate the run state (for streaming, memory, etc.). */
  execute: (input: I, ctx: ToolCtx) => Promise<ToolResult<O>>;
  /** Whether this tool spawns a sub-agent (shown specially in the DAG). */
  spawnsAgent?: boolean;
}

export interface ToolCtx {
  runId: string;
  parentNodeId: string;
  /** Called with cell refs encountered during execution — for citations + provenance. */
  recordCellRefs: (refs: CellRef[]) => void;
}

export interface ToolResult<O = unknown> {
  output: O;
  /** Cells read during execution — surfaced in UI as provenance badges. */
  cellsRead?: CellRef[];
  /** Short, human-readable summary for the tool-call node. */
  summary?: string;
}

export type AnyToolDef = ToolDef<unknown, unknown>;
