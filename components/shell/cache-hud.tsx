"use client";

import { useRunStore } from "@/lib/store/run";
import { usePathname } from "next/navigation";
import { Database } from "lucide-react";
import { useMemo } from "react";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function CacheHud() {
  const pathname = usePathname();
  const runs = useRunStore((s) => s.runs);

  const stats = useMemo(() => {
    // If viewing a specific run, scope the HUD to that run only.
    const m = /^\/reports\/([^/]+)/.exec(pathname);
    if (m && runs[m[1]]) {
      const r = runs[m[1]];
      return {
        cached: r.cacheTokens,
        read: r.inputTokens + r.outputTokens,
        scope: "run" as const,
      };
    }
    let cached = 0;
    let read = 0;
    for (const r of Object.values(runs)) {
      cached += r.cacheTokens;
      read += r.inputTokens + r.outputTokens;
    }
    return { cached, read, scope: "session" as const };
  }, [runs, pathname]);

  const hit = stats.cached + stats.read === 0 ? 0 : stats.cached / (stats.cached + stats.read);
  const hasActivity = stats.cached + stats.read > 0;

  return (
    <div
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition ${
        hasActivity ? "border-accent-blue/40 bg-accent-blue/5" : "border-border/80 bg-background"
      }`}
      title={stats.scope === "run" ? "Tokens for current run" : "Tokens this session"}
    >
      <Database className="h-3 w-3 text-muted-foreground" />
      <span className="text-muted-foreground">Cache</span>
      <span className="tabular-nums font-medium">{formatTokens(stats.cached)}</span>
      <span className="text-muted-foreground">·</span>
      <span className="tabular-nums text-muted-foreground">{formatTokens(stats.read)}</span>
      <span className="text-muted-foreground">·</span>
      <span className="tabular-nums font-medium text-positive">{(hit * 100).toFixed(0)}%</span>
    </div>
  );
}
