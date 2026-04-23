"use client";

import { useEffect, useRef } from "react";
import { useRunStore } from "@/lib/store/run";
import type { RunEvent } from "@/lib/agents/events";

export function useRunStream(runId: string) {
  const upsert = useRunStore((s) => s.upsert);
  const started = useRef(false);

  useEffect(() => {
    if (!runId || started.current) return;
    started.current = true;

    const abort = new AbortController();
    const es = new EventSource(`/api/runs/${runId}/events`);
    const batch: RunEvent[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      if (batch.length === 0) return;
      const items = batch.splice(0, batch.length);
      upsert(runId, items);
    };
    const schedule = () => {
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flush();
      }, 30);
    };
    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data) as RunEvent;
        batch.push(parsed);
        schedule();
        if (parsed.type === "run_completed" || parsed.type === "run_failed") {
          flush();
          es.close();
        }
      } catch {
        // ignore malformed
      }
    };
    es.onerror = () => {
      // auto-reconnect is built into EventSource
    };
    return () => {
      started.current = false;
      abort.abort();
      es.close();
      if (flushTimer) clearTimeout(flushTimer);
      flush();
    };
  }, [runId, upsert]);

  return useRunStore((s) => s.runs[runId]);
}
