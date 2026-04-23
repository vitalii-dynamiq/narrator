"use client";

import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { formatEurCompact, formatDelta } from "@/lib/format";

interface Bar {
  id: string;
  label: string;
  value: number;
  cumulative: number;
  kind: "anchor" | "contribution";
  direction: "up" | "down" | "neutral";
}

interface WaterfallResponse {
  entity: string;
  startValue: number;
  endValue: number;
  bars: Bar[];
  metric: string;
}

export function VarianceWaterfall({ entityId }: { entityId: string }) {
  const { data } = useQuery({
    queryKey: ["waterfall", entityId],
    queryFn: async () => {
      const r = await fetch(`/api/waterfall/${entityId}`);
      if (!r.ok) throw new Error("waterfall fetch failed");
      return (await r.json()) as WaterfallResponse;
    },
  });

  if (!data) {
    return (
      <Card className="p-5 h-[260px]">
        <div className="text-[13px] font-semibold mb-1">EBITDA variance · Actual YTD vs Budget YTD</div>
        <div className="text-[11px] text-muted-foreground">Loading…</div>
      </Card>
    );
  }

  const maxVal = Math.max(
    ...data.bars.map((b) => Math.abs(b.kind === "anchor" ? b.value : b.cumulative)),
    Math.abs(data.startValue),
    Math.abs(data.endValue)
  );

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold">EBITDA variance · Actual YTD vs Budget YTD</div>
          <div className="text-[11px] text-muted-foreground">
            Contribution to EBITDA gap by line item · €, YTD Mar 2026
          </div>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          <div>
            Start {formatEurCompact(data.startValue)} → End{" "}
            <span className="font-medium text-foreground">{formatEurCompact(data.endValue)}</span>
          </div>
          <div className={data.endValue - data.startValue >= 0 ? "text-positive" : "text-negative"}>
            Net Δ {formatDelta(data.endValue - data.startValue)}
          </div>
        </div>
      </div>

      <div className="relative mt-4 h-[170px] flex items-end gap-2">
        {data.bars.map((b, i) => {
          const pct = (Math.abs(b.kind === "anchor" ? b.value : b.value) / maxVal) * 100;
          const topOffsetPct =
            b.kind === "anchor"
              ? 0
              : b.direction === "up"
              ? ((maxVal - (b.cumulative)) / maxVal) * 100
              : ((maxVal - b.cumulative) / maxVal) * 100;
          const color =
            b.direction === "up" ? "var(--positive)" : b.direction === "down" ? "var(--negative)" : "var(--muted-foreground)";
          return (
            <div key={b.id} className="flex-1 flex flex-col items-center">
              <div className="text-[10px] text-muted-foreground tabular-nums mb-1">
                {b.kind === "anchor"
                  ? formatEurCompact(b.value)
                  : formatDelta(b.value, { compact: true })}
              </div>
              <div className="relative w-full h-[140px] flex items-end">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${pct}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full rounded-sm"
                  style={{
                    backgroundColor: color,
                    opacity: b.kind === "anchor" ? 0.95 : 0.65,
                    minHeight: 2,
                    marginBottom: b.kind === "contribution" && b.direction !== "up" ? `${topOffsetPct}%` : undefined,
                  }}
                />
              </div>
              <div className="mt-1.5 text-[10px] text-center text-muted-foreground leading-tight truncate w-full">
                {b.label}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
