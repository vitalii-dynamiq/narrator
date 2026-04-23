"use client";

import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatEurCompact, formatDelta, formatPct, signedClass } from "@/lib/format";
import type { PortfolioResponse } from "./portfolio-overview";

// Headline KPIs for the portfolio page. Every number here is computed client-
// side from the `/api/portfolio` hero payload — which in turn calls resolve()
// + portfolioFV() on the live cube. No hardcoded narrative, no fake sparklines.
export function HeroKpis({ data }: { data: PortfolioResponse["hero"] }) {
  const fvDelta = data.aum - data.aumPrior;
  const fvChangePct = data.aumPrior > 0 ? fvDelta / data.aumPrior : 0;

  const ebitdaVarBudget = data.totalEbitdaYtd - data.totalEbitdaBudget;
  const ebitdaVarBudgetPct =
    data.totalEbitdaBudget > 0 ? ebitdaVarBudget / data.totalEbitdaBudget : 0;

  const currentMargin =
    data.totalRevenueYtd > 0 ? data.totalEbitdaYtd / data.totalRevenueYtd : 0;
  const budgetMargin =
    data.totalRevenueBudget > 0
      ? data.totalEbitdaBudget / data.totalRevenueBudget
      : 0;
  const marginDeltaBps = Math.round((currentMargin - budgetMargin) * 10_000);

  const tiles: Array<{
    label: string;
    value: string;
    subtitle: string;
    positive: boolean;
    signedValue: boolean;
  }> = [
    {
      label: "Portfolio Fair Value",
      value: formatEurCompact(data.aum),
      subtitle: `${formatDelta(fvDelta)} vs V1 · ${formatPct(fvChangePct, { signed: true })}`,
      positive: fvDelta >= 0,
      signedValue: false,
    },
    {
      label: "Fair Value Change (V1 → V2)",
      value: formatDelta(data.fvChange, { compact: true }),
      subtitle: "Bridge: EBITDA + Multiple + Leverage + FX + Cross + Other",
      positive: data.fvChange >= 0,
      signedValue: true,
    },
    {
      label: "EBITDA YTD vs Budget",
      value: formatDelta(ebitdaVarBudget, { compact: true }),
      subtitle: `${formatEurCompact(data.totalEbitdaYtd)} Actual · ${formatEurCompact(data.totalEbitdaBudget)} Budget · ${formatPct(
        ebitdaVarBudgetPct,
        { signed: true }
      )}`,
      positive: ebitdaVarBudget >= 0,
      signedValue: true,
    },
    {
      label: "Portfolio EBITDA Margin",
      value: formatPct(currentMargin, { digits: 1 }),
      subtitle: `${marginDeltaBps >= 0 ? "+" : ""}${marginDeltaBps}bps vs Budget ${formatPct(
        budgetMargin,
        { digits: 1 }
      )}`,
      positive: marginDeltaBps >= 0,
      signedValue: false,
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
            className={`text-[24px] font-semibold tracking-tight tabular-nums pt-1.5 ${
              t.signedValue ? signedClass(t.positive ? 1 : -1) : ""
            }`}
          >
            {t.value}
          </div>
          <div className="text-[11.5px] text-muted-foreground tabular-nums pt-0.5">
            {t.subtitle}
          </div>
        </Card>
      ))}
    </div>
  );
}
