// Registry of client-executed tools available to the orchestrator.
// Math-heavy tools (variance, bridge, drivers, insights) have been folded
// into the Anthropic-hosted `code_execution_20260120` tool — Claude writes
// Python to do its own computation, leaving this server responsible only
// for (1) reading the cube and (2) streaming structured commentary.

import type { AnyToolDef } from "./types";
import { queryCubeTool } from "./query-cube";
import { writeSectionTool } from "./write-section";
import { finishTool } from "./finish";

// Client-executed tools. Server tools (memory_20250818, code_execution_20260120)
// are declared directly in orchestrator.ts and handled via content blocks — not
// part of this registry.
export const TOOLS: AnyToolDef[] = [
  queryCubeTool,
  writeSectionTool,
  finishTool,
] as AnyToolDef[];

export const TOOLS_BY_NAME: Record<string, AnyToolDef> = Object.fromEntries(
  TOOLS.map((t) => [t.name, t])
);
