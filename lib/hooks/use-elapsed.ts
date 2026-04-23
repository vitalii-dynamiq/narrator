"use client";

import { useEffect, useState } from "react";

/**
 * Live elapsed-ms since `startedAt`. Ticks every second while `active`.
 * Returns 0 when `startedAt` is null.
 */
export function useElapsed(startedAt: number | null, active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active || !startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt, active]);

  return startedAt ? Math.max(0, now - startedAt) : 0;
}
