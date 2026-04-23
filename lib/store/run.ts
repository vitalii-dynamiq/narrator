"use client";

import { create } from "zustand";
import type { RunEvent, RunState, TimelineEntry } from "@/lib/agents/events";
import { nanoid } from "nanoid";

interface RunStore {
  runs: Record<string, RunState>;
  upsert: (runId: string, events: RunEvent[]) => void;
  reset: (runId: string) => void;
}

function emptyRun(runId: string): RunState {
  return {
    runId,
    status: "pending",
    error: null,
    nodes: {},
    edges: [],
    sections: {},
    timeline: [],
    cacheTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    startedAt: Date.now(),
    completedAt: null,
    dagReady: false,
  };
}

function reduceState(state: RunState | undefined, events: RunEvent[]): RunState {
  const next: RunState = state
    ? { ...state, nodes: { ...state.nodes }, timeline: [...state.timeline] }
    : emptyRun(events[0]?.runId ?? "");

  for (const ev of events) {
    switch (ev.type) {
      case "run_started":
        next.status = "running";
        next.startedAt = Date.now();
        break;
      case "dag_ready":
        next.nodes = Object.fromEntries(
          ev.nodes.map((n) => [
            n.id,
            {
              id: n.id,
              kind: "agent" as const,
              agentId: n.agentId,
              label: n.label,
              model: n.model,
              status: "pending" as const,
              thinking: "",
              textDelta: "",
              toolCalls: [],
              output: null,
              tokensIn: 0,
              tokensOut: 0,
              tokensCached: 0,
              startedAt: null,
              completedAt: null,
              summary: n.summary,
            },
          ])
        );
        next.edges = ev.edges;
        next.dagReady = true;
        break;
      case "node_spawned":
        next.nodes[ev.node.id] = {
          id: ev.node.id,
          kind: ev.node.kind,
          agentId: ev.node.agentId,
          toolName: ev.node.toolName,
          toolInput: ev.node.toolInput,
          label: ev.node.label,
          model: ev.node.model,
          summary: ev.node.summary,
          parentId: ev.node.parentId,
          status: "pending",
          thinking: "",
          textDelta: "",
          toolCalls: [],
          output: null,
          tokensIn: 0,
          tokensOut: 0,
          tokensCached: 0,
          startedAt: null,
          completedAt: null,
        };
        if (ev.node.parentId) {
          const edge: [string, string] = [ev.node.parentId, ev.node.id];
          if (!next.edges.some(([a, b]) => a === edge[0] && b === edge[1])) {
            next.edges = [...next.edges, edge];
          }
        }
        next.dagReady = true;
        break;
      case "edge_added":
        if (!next.edges.some(([a, b]) => a === ev.from && b === ev.to)) {
          next.edges = [...next.edges, [ev.from, ev.to]];
        }
        break;
      case "node_started": {
        const node = next.nodes[ev.nodeId];
        if (node) {
          node.status = "running";
          node.startedAt = Date.now();
        }
        break;
      }
      case "thinking_delta": {
        const node = next.nodes[ev.nodeId];
        if (node) node.thinking = (node.thinking ?? "") + ev.text;
        appendThinkingToTimeline(next, ev.text);
        break;
      }
      case "text_delta": {
        const node = next.nodes[ev.nodeId];
        if (node) node.textDelta = (node.textDelta ?? "") + ev.text;
        break;
      }
      case "tool_call": {
        const node = next.nodes[ev.nodeId];
        if (node) {
          node.toolCalls.push({
            callId: ev.callId,
            name: ev.name,
            input: ev.input,
            status: "running",
            startedAt: Date.now(),
          });
        }
        // Timeline: close the open thinking entry by starting a new tool entry
        next.timeline.push({
          kind: "tool",
          id: `tl_${nanoid(6)}`,
          callId: ev.callId,
          name: ev.name,
          input: ev.input,
          status: "running",
          startedAt: Date.now(),
        });
        break;
      }
      case "tool_result": {
        const node = next.nodes[ev.nodeId];
        if (node) {
          const tc = node.toolCalls.find((c) => c.callId === ev.callId);
          if (tc) {
            tc.status = "done";
            tc.output = ev.output;
            tc.cellsRead = ev.cellsRead;
            tc.ms = ev.ms;
          }
        }
        // Timeline: find the matching tool entry and close it
        for (let i = next.timeline.length - 1; i >= 0; i--) {
          const entry = next.timeline[i];
          if (entry.kind === "tool" && entry.callId === ev.callId) {
            next.timeline[i] = {
              ...entry,
              output: ev.output,
              cellsRead: ev.cellsRead,
              ms: ev.ms,
              status: "done",
            };
            break;
          }
        }
        break;
      }
      case "cache_hit":
        next.cacheTokens += ev.tokens;
        break;
      case "node_completed": {
        const node = next.nodes[ev.nodeId];
        if (node) {
          node.status = "done";
          node.completedAt = Date.now();
          node.tokensIn = ev.tokensIn;
          node.tokensOut = ev.tokensOut;
          node.tokensCached = ev.tokensCached;
          node.output = ev.output;
        }
        next.inputTokens += ev.tokensIn;
        next.outputTokens += ev.tokensOut;
        break;
      }
      case "section_ready": {
        next.sections[ev.section.id] = ev.section;
        break;
      }
      case "run_completed":
        next.status = "completed";
        next.completedAt = Date.now();
        break;
      case "run_failed":
        next.status = "failed";
        next.error = ev.error;
        next.completedAt = Date.now();
        break;
    }
  }
  return next;
}

/**
 * Append a thinking chunk to the timeline. If the last entry is still an open
 * thinking block (no tool call has landed since), append the text to it;
 * otherwise start a new thinking block.
 */
function appendThinkingToTimeline(state: RunState, text: string) {
  const last = state.timeline[state.timeline.length - 1];
  if (last && last.kind === "thinking") {
    state.timeline[state.timeline.length - 1] = {
      ...last,
      text: last.text + text,
    };
    return;
  }
  state.timeline.push({
    kind: "thinking",
    id: `tl_${nanoid(6)}`,
    text,
    startedAt: Date.now(),
  });
}

export const useRunStore = create<RunStore>((set) => ({
  runs: {},
  upsert: (runId, events) =>
    set((state) => {
      const existing = state.runs[runId];
      return {
        runs: {
          ...state.runs,
          [runId]: reduceState(existing, events),
        },
      };
    }),
  reset: (runId) =>
    set((state) => {
      const next = { ...state.runs };
      delete next[runId];
      return { runs: next };
    }),
}));
