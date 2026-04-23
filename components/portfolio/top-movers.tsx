"use client";

import { Card } from "@/components/ui/card";
import { ResponsiveContainer, Line, LineChart, YAxis } from "recharts";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { TileNode } from "./portfolio-overview";
import { formatDelta, formatEurCompact, formatPct } from "@/lib/format";

interface Props {
  title: string;
  subtitle: string;
  entries: TileNode[];
  direction: "up" | "down";
  /**
   * Sparkline Y-domain shared across contributor + detractor lists so the
   * visual height of each mini-chart encodes real relative magnitude. The
   * parent (PortfolioOverview) computes a global [min, max] across every row.
   */
  sparklineDomain?: [number, number];
}

export function TopMovers({ title, subtitle, entries, direction, sparklineDomain }: Props) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2.5">
        <div>
          <div className="text-[13px] font-semibold flex items-center gap-1.5">
            {direction === "up" ? (
              <ArrowUpRight className="h-3.5 w-3.5 text-positive" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5 text-negative" />
            )}
            {title}
          </div>
          <div className="text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
      </div>
      <ul className="divide-y divide-border/70">
        {entries.map((e) => (
          <li key={e.id}>
            <Link
              href={`/entity/${e.id}`}
              className="grid grid-cols-[1fr_56px_auto] items-center gap-3 py-2.5 hover:bg-accent/50 transition -mx-1 px-1 rounded"
            >
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium truncate">{e.label}</div>
                <div className="text-[10.5px] text-muted-foreground leading-tight mt-0.5">
                  {oneLiner(e, direction)}
                </div>
              </div>
              <div className="h-8">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={e.sparkline.map((v, i) => ({ i, v }))}>
                    {sparklineDomain && (
                      <YAxis hide domain={sparklineDomain} />
                    )}
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke={direction === "up" ? "var(--positive)" : "var(--negative)"}
                      strokeWidth={1.4}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="text-right">
                <div
                  className={`text-[12.5px] tabular-nums font-semibold ${
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
    marginBps > 0
      ? `+${marginBps}bps margin lift`
      : marginBps < 0
      ? `${marginBps}bps margin compression`
      : "flat margin";
  if (direction === "up") {
    return `${abs} ahead of plan · ${marginWord} · revenue ${formatPct(e.varianceBudgetPct, { signed: true })}`;
  }
  return `${abs} below plan · ${marginWord} · revenue ${formatPct(e.varianceBudgetPct, { signed: true })}`;
}
