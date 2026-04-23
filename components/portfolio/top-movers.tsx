"use client";

import { Card } from "@/components/ui/card";
import { ResponsiveContainer, Line, LineChart } from "recharts";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { TileNode } from "./portfolio-overview";
import { formatDelta, formatEurCompact, formatPct } from "@/lib/format";

interface Props {
  title: string;
  subtitle: string;
  entries: TileNode[];
  direction: "up" | "down";
}

export function TopMovers({ title, subtitle, entries, direction }: Props) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[13px] font-semibold">{title}</div>
          <div className="text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-full ${
            direction === "up" ? "bg-positive-soft" : "bg-negative-soft"
          }`}
        >
          {direction === "up" ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
        </div>
      </div>
      <ul className="divide-y divide-border/70">
        {entries.map((e) => (
          <li key={e.id}>
            <Link
              href={`/entity/${e.id}`}
              className="flex items-center gap-3 py-2 hover:bg-accent/50 transition -mx-1 px-1 rounded"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] font-medium truncate">{e.label}</div>
                <div className="text-[10.5px] text-muted-foreground italic leading-tight">
                  {oneLiner(e, direction)}
                </div>
              </div>
              <div className="h-8 w-16">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={e.sparkline.map((v, i) => ({ i, v }))}>
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke={direction === "up" ? "var(--positive)" : "var(--negative)"}
                      strokeWidth={1.2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="text-right">
                <div
                  className={`text-[12px] tabular-nums font-medium ${
                    e.ebitdaVarBudget >= 0 ? "text-positive" : "text-negative"
                  }`}
                >
                  {formatDelta(e.ebitdaVarBudget)}
                </div>
                <div className="text-[10px] text-muted-foreground tabular-nums">
                  {formatEurCompact(e.ebitdaYtd)} · {formatPct(e.marginPctCurrent, { digits: 1 })}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function oneLiner(e: TileNode, direction: "up" | "down"): string {
  const absVar = Math.abs(e.ebitdaVarBudget);
  const abs = formatEurCompact(absVar);
  const marginDelta = e.marginPctCurrent - e.marginPctBudget;
  const marginBps = Math.round(marginDelta * 10_000);
  const marginWord =
    marginBps > 0 ? `+${marginBps}bps margin lift` : marginBps < 0 ? `${marginBps}bps margin compression` : "flat margin";
  if (direction === "up") {
    return `${abs} ahead of budget on ${marginWord}; revenue ${formatPct(e.varianceBudgetPct, { signed: true })}`;
  }
  return `${abs} behind budget on ${marginWord}; revenue ${formatPct(e.varianceBudgetPct, { signed: true })}`;
}
