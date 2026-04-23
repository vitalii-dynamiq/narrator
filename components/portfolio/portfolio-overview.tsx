"use client";

import { useQuery } from "@tanstack/react-query";
import { HeroKpis } from "./hero-kpis";
import { PortfolioHeatmap } from "./portfolio-heatmap";
import { TopMovers } from "./top-movers";
import { AskHero } from "./ask-hero";
import { Skeleton } from "@/components/ui/skeleton";

export interface TileNode {
  id: string;
  label: string;
  level: "group" | "project" | "entity";
  parent?: string;
  revenueYtd: number;
  revenueBudget: number;
  revenuePy: number;
  ebitdaYtd: number;
  ebitdaBudget: number;
  ebitdaPy: number;
  marginPctCurrent: number;
  marginPctBudget: number;
  varianceBudgetPct: number;
  ebitdaVarBudget: number;
  fvChange: number;
  aum: number;
  sparkline: number[];
}

export interface PortfolioResponse {
  asOf: string;
  hero: {
    aum: number;
    aumPrior: number;
    fvChange: number;
    totalRevenueYtd: number;
    totalRevenueBudget: number;
    totalEbitdaYtd: number;
    totalEbitdaBudget: number;
    totalEbitdaPy: number;
  };
  tiles: TileNode[];
  contributors: TileNode[];
  detractors: TileNode[];
}

export function PortfolioOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ["portfolio"],
    queryFn: async () => {
      const res = await fetch("/api/portfolio");
      if (!res.ok) throw new Error("Portfolio load failed");
      return (await res.json()) as PortfolioResponse;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Skeleton className="h-7 w-72" />
            <Skeleton className="h-4 w-96 mt-2" />
          </div>
          <Skeleton className="h-9 w-44" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px]" />
          ))}
        </div>
        <Skeleton className="h-[480px]" />
      </div>
    );
  }

  return (
    <div className="p-6 pb-10 max-w-[1440px] mx-auto space-y-6">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight leading-tight">
          Portfolio overview
        </h1>
        <p className="text-[14px] text-muted-foreground mt-1.5">
          As of {formatAsOf(data.asOf)} · 3 consolidated groups · 13 projects · 30 entities
        </p>
      </div>

      <AskHero />

      <HeroKpis data={data.hero} />

      <PortfolioHeatmap tiles={data.tiles} />

      {(() => {
        // Shared sparkline Y-domain across contributors + detractors so the
        // visual height of each mini-chart encodes real relative magnitude,
        // not row-local auto-scale.
        const allSpark = [
          ...data.contributors.flatMap((e) => e.sparkline),
          ...data.detractors.flatMap((e) => e.sparkline),
        ];
        const sparkMin = allSpark.length ? Math.min(...allSpark) : 0;
        const sparkMax = allSpark.length ? Math.max(...allSpark) : 1;
        const pad = Math.max(1, (sparkMax - sparkMin) * 0.1);
        const sparklineDomain: [number, number] = [sparkMin - pad, sparkMax + pad];
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TopMovers
              title="Top Contributors"
              subtitle="EBITDA variance vs Budget"
              entries={data.contributors}
              direction="up"
              sparklineDomain={sparklineDomain}
            />
            <TopMovers
              title="Top Detractors"
              subtitle="EBITDA variance vs Budget"
              entries={data.detractors}
              direction="down"
              sparklineDomain={sparklineDomain}
            />
          </div>
        );
      })()}
    </div>
  );
}

function formatAsOf(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}
