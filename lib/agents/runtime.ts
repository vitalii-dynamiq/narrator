// Run-level orchestration: manages DAG execution and event emission.

import { EventEmitter } from "events";
import { nanoid } from "nanoid";
import type { RunEvent } from "./events";

interface Run {
  id: string;
  emitter: EventEmitter;
  buffer: RunEvent[];
  status: "pending" | "running" | "completed" | "failed";
  startedAt: number;
  completedAt?: number;
  meta: Record<string, unknown>;
}

const runs = new Map<string, Run>();

export function createRun(meta: Record<string, unknown>): string {
  const id = `run_${nanoid(10)}`;
  const emitter = new EventEmitter();
  emitter.setMaxListeners(32);
  runs.set(id, {
    id,
    emitter,
    buffer: [],
    status: "pending",
    startedAt: Date.now(),
    meta,
  });
  return id;
}

export function getRun(id: string): Run | undefined {
  return runs.get(id);
}

export function emitEvent(runId: string, event: RunEvent) {
  const run = runs.get(runId);
  if (!run) return;
  run.buffer.push(event);
  if (run.buffer.length > 4000) run.buffer.splice(0, run.buffer.length - 4000);
  run.emitter.emit("event", event);
  if (event.type === "run_completed") {
    run.status = "completed";
    run.completedAt = Date.now();
  } else if (event.type === "run_failed") {
    run.status = "failed";
    run.completedAt = Date.now();
  } else if (event.type === "run_started") {
    run.status = "running";
  }
}

export function subscribe(runId: string, onEvent: (ev: RunEvent) => void): () => void {
  const run = runs.get(runId);
  if (!run) return () => undefined;
  for (const ev of run.buffer) onEvent(ev);
  run.emitter.on("event", onEvent);
  return () => run.emitter.off("event", onEvent);
}

export function getRunSnapshot(runId: string): { status: Run["status"]; events: RunEvent[] } | null {
  const run = runs.get(runId);
  if (!run) return null;
  return { status: run.status, events: [...run.buffer] };
}

export async function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ----------------------- Cancellation -----------------------
// The UI can post to /api/runs/[runId]/cancel to stop an in-flight run. The
// orchestrator registers its AbortController here on start; cancelRun aborts
// the controller (breaking the current Anthropic stream) and sets a flag the
// orchestrator checks between turns.

interface CancelState {
  cancelled: boolean;
  controller: AbortController;
}

const cancelState = new Map<string, CancelState>();

export function registerCancel(runId: string): AbortController {
  const controller = new AbortController();
  cancelState.set(runId, { cancelled: false, controller });
  return controller;
}

export function cancelRun(runId: string): boolean {
  const s = cancelState.get(runId);
  if (!s) return false;
  s.cancelled = true;
  try {
    s.controller.abort();
  } catch {
    // ignore
  }
  return true;
}

export function isCancelled(runId: string): boolean {
  return cancelState.get(runId)?.cancelled ?? false;
}

export function disposeCancel(runId: string): void {
  cancelState.delete(runId);
}
