"use client";

import { Card } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { TileNode } from "./portfolio-overview";
import { formatEurCompact, formatDelta, formatPct } from "@/lib/format";
import { useState } from "react";

type Level = "group" | "project" | "entity";

interface Props {
  tiles: TileNode[];
}

function tileColor(varPct: number): string {
  const c = Math.max(-1, Math.min(1, varPct / 0.15));
  if (c >= 0) {
    const alpha = 0.07 + c * 0.28;
    return `color-mix(in oklch, var(--positive) ${Math.round(alpha * 100)}%, white)`;
  }
  const alpha = 0.07 + Math.abs(c) * 0.28;
  return `color-mix(in oklch, var(--negative) ${Math.round(alpha * 100)}%, white)`;
}

export function PortfolioHeatmap({ tiles }: Props) {
  const [level, setLevel] = useState<Level>("project");
  const router = useRouter();

  const filtered = tiles.filter((t) => t.level === level);
  const maxAum = Math.max(...filtered.map((t) => t.aum));

  const navigate = (t: TileNode) => {
    switch (t.level) {
      case "group":
        router.push(`/group/${t.id}`);
        break;
      case "project":
        router.push(`/project/${t.id}`);
        break;
      case "entity":
        router.push(`/entity/${t.id}`);
        break;
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[13px] font-semibold">Portfolio heatmap</div>
          <div className="text-[11.5px] text-muted-foreground">
            Tile size = fair value · Color = revenue YTD vs budget
          </div>
        </div>
        <div className="flex items-center gap-0.5 rounded-md border border-border/80 bg-background p-0.5 text-[11px]">
          {(["group", "project", "entity"] as Level[]).map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`px-2 py-1 rounded transition-colors ${
                level === l
                  ? "bg-accent-blue/10 text-accent-blue font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {l === "group" ? "Groups" : l === "project" ? "Projects" : "Entities"}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`grid gap-1.5 ${
          level === "entity"
            ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
            : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
        }`}
      >
        {filtered
          .slice()
          .sort((a, b) => b.aum - a.aum)
          .map((t) => {
            const size = 60 + (t.aum / maxAum) * 80;
            return (
              <HoverCard key={t.id}>
                <HoverCardTrigger
                  render={
                    <button
                      onClick={() => navigate(t)}
                      className="group relative flex flex-col justify-between text-left rounded-md border border-border/70 p-2 transition-all hover:border-foreground/50 hover:ring-2 hover:ring-foreground/10"
                      style={{
                        minHeight: size,
                        background: tileColor(t.varianceBudgetPct),
                      }}
                    >
                      <div className="text-[11px] font-semibold tracking-tight leading-tight truncate">
                        {t.label}
                      </div>
                      <div className="flex items-end justify-between gap-1">
                        <div className="text-[10.5px] text-foreground/80 tabular-nums">
                          {formatEurCompact(t.revenueYtd)}
                        </div>
                        <div className="text-[10px] font-medium tabular-nums">
                          {formatPct(t.varianceBudgetPct, { signed: true })}
                        </div>
                      </div>
                    </button>
                  }
                />
                <HoverCardContent align="start" className="w-80 p-3 text-[11.5px]">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t.level}
                  </div>
                  <div className="text-[14px] font-semibold pt-0.5">{t.label}</div>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <div className="text-muted-foreground">Revenue YTD</div>
                    <div className="text-right tabular-nums">
                      {formatEurCompact(t.revenueYtd)}
                    </div>
                    <div className="text-muted-foreground">Budget YTD</div>
                    <div className="text-right tabular-nums">
                      {formatEurCompact(t.revenueBudget)}
                    </div>
                    <div className="text-muted-foreground">Δ vs Budget</div>
                    <div className={`text-right tabular-nums font-medium ${
                      t.varianceBudgetPct >= 0 ? "text-positive" : "text-negative"
                    }`}>
                      {formatDelta(t.revenueYtd - t.revenueBudget)} ({formatPct(t.varianceBudgetPct, { signed: true })})
                    </div>
                    <div className="text-muted-foreground">EBITDA YTD</div>
                    <div className="text-right tabular-nums">{formatEurCompact(t.ebitdaYtd)}</div>
                    <div className="text-muted-foreground">EBITDA Margin</div>
                    <div className="text-right tabular-nums">
                      {formatPct(t.marginPctCurrent)} ({formatPct(t.marginPctCurrent - t.marginPctBudget, { signed: true, digits: 1 })} vs bud)
                    </div>
                    <div className="text-muted-foreground">FV Change</div>
                    <div className={`text-right tabular-nums ${t.fvChange >= 0 ? "text-positive" : "text-negative"}`}>
                      {formatDelta(t.fvChange)}
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
            );
          })}
      </div>
    </Card>
  );
}
