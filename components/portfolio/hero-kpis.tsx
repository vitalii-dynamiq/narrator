"use client";

import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Sparkles } from "lucide-react";
import { formatEur, formatEurCompact, formatDelta, formatPct, signedClass } from "@/lib/format";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { PortfolioResponse } from "./portfolio-overview";

export function HeroKpis({ data }: { data: PortfolioResponse["hero"] }) {
  const aumChangePct = data.aumPrior > 0 ? (data.aum - data.aumPrior) / data.aumPrior : 0;
  const fvChange = data.fvChange;
  const ebitdaVarBudget = data.totalEbitdaYtd - data.totalEbitdaBudget;
  const ebitdaVarBudgetPct =
    data.totalEbitdaBudget > 0 ? ebitdaVarBudget / data.totalEbitdaBudget : 0;
  const irr = 0.184;
  const irrDelta = 0.003;

  const tiles = [
    {
      label: "Portfolio Fair Value",
      value: formatEur(data.aum, { digits: 0 }),
      subtitle: `${formatDelta(data.aum - data.aumPrior)} vs V1 · ${formatPct(aumChangePct, { signed: true })}`,
      positive: data.aum - data.aumPrior >= 0,
      commentary: "Fair value change driven by multiple expansion in Atlas Benelux (+€14M) offset by Fortuna DE compression (−€4.1M).",
      series: sparkFake([data.aumPrior, data.aum], 12, 0.015),
    },
    {
      label: "Fair Value Change",
      value: formatDelta(fvChange, { compact: false }),
      subtitle: "Valuation V2 vs V1 · bridge decomposed across 6 legs",
      positive: fvChange >= 0,
      commentary: "Multiple effect contributes +€31M, EBITDA effect −€6M, FX +€1.2M, leverage-neutral.",
      series: sparkFake([0, fvChange], 12, 0.1),
    },
    {
      label: "EBITDA YTD vs Budget",
      value: formatDelta(ebitdaVarBudget, { compact: false }),
      subtitle: `${formatEurCompact(data.totalEbitdaYtd)} vs ${formatEurCompact(data.totalEbitdaBudget)} · ${formatPct(
        ebitdaVarBudgetPct,
        { signed: true }
      )}`,
      positive: ebitdaVarBudget >= 0,
      commentary:
        "Four projects materially below plan; Fortuna and Kadenza carry most of the gap; partly offset by Vela and Helix.",
      series: sparkFake([data.totalEbitdaBudget, data.totalEbitdaYtd], 12, 0.03),
    },
    {
      label: "Net IRR (since inception)",
      value: formatPct(irr, { digits: 1 }),
      subtitle: `${formatPct(irrDelta, { signed: true, digits: 1 })} vs prior quarter · above gross target of 17%`,
      positive: true,
      commentary: "Weighted average hold period 3.4y; DPI 0.34x; TVPI 1.52x.",
      series: sparkFake([0.18, irr], 12, 0.01),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <Card
          key={t.label}
          className="p-4 transition-shadow hover:shadow-[0_1px_3px_rgba(17,24,39,0.04),0_4px_14px_rgba(17,24,39,0.06)]"
        >
          <div className="flex items-start justify-between">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
              {t.label}
            </div>
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full ${
                t.positive ? "bg-positive-soft" : "bg-negative-soft"
              }`}
            >
              {t.positive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
            </div>
          </div>
          <div
            className={`text-[22px] font-semibold tracking-tight tabular-nums pt-1 ${
              t.label.includes("Change") ? signedClass(t.positive ? 1 : -1) : ""
            }`}
          >
            {t.value}
          </div>
          <div className="text-[11.5px] text-muted-foreground tabular-nums">{t.subtitle}</div>
          <div className="mt-2 h-[32px] -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={t.series}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={t.positive ? "var(--positive)" : "var(--negative)"}
                  strokeWidth={1.3}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="pt-2 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground italic">
            <Sparkles className="h-3 w-3 shrink-0 mt-0.5 text-accent-blue" />
            <span>{t.commentary}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

function sparkFake(between: [number, number], steps = 12, jitter = 0.02) {
  const [a, b] = between;
  const delta = b - a;
  const out: { v: number }[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const noise = (Math.sin(i * 1.3 + a) * 0.5 + Math.cos(i * 0.6 + b) * 0.5) * jitter * Math.abs(delta || 1);
    out.push({ v: a + delta * t + noise });
  }
  return out;
}
