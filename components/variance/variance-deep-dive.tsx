"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatEurCompact, signedClass } from "@/lib/format";
import { ChevronRight, GitBranch, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useMateriality } from "@/lib/store/materiality";
import { ScopePicker } from "@/components/shell/scope-picker";

type Account = "EBITDA" | "Revenue" | "GrossProfit" | "NetDebt";
type Basis = "vs_budget" | "vs_prior_year" | "vs_mgmt_forecast";

const ACCOUNT_LABELS: Record<Account, string> = {
  EBITDA: "EBITDA",
  Revenue: "Revenue",
  GrossProfit: "Gross Profit",
  NetDebt: "Net Debt",
};

const BASIS_LABELS: Record<Basis, string> = {
  vs_budget: "vs Budget",
  vs_prior_year: "vs Prior Year",
  vs_mgmt_forecast: "vs Mgmt Forecast",
};

interface DriversResponse {
  parent: { id: string; label: string; delta: number; valueA: number; valueB: number };
  children: Array<{
    id: string;
    label: string;
    delta: number;
    deltaShare: number;
    valueA: number;
    valueB: number;
    hasChildren: boolean;
  }>;
  parentAncestor: string | null;
}

export function VarianceDeepDive({ scope }: { scope: string }) {
  const router = useRouter();
  const { thresholdEur } = useMateriality();
  const [account, setAccount] = useState<Account>("EBITDA");
  const [basis, setBasis] = useState<Basis>("vs_budget");
  const { data, isLoading } = useQuery({
    queryKey: ["drivers", scope, account, basis],
    queryFn: async () => {
      const r = await fetch(`/api/drivers/${scope}?account=${account}&basis=${basis}`);
      if (!r.ok) throw new Error("drivers fetch failed");
      return (await r.json()) as DriversResponse;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 max-w-[1440px] mx-auto">
        <Skeleton className="h-10 w-80 mb-4" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  const maxChildDelta = Math.max(...data.children.map((c) => Math.abs(c.delta)), 1);

  return (
    <div className="p-6 pb-10 max-w-[1440px] mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <GitBranch className="h-3 w-3" />
            Variance Deep-Dive
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight mt-1">{data.parent.label}</h1>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            {ACCOUNT_LABELS[account]} YTD {BASIS_LABELS[basis]} — sub-entity contribution tree
          </p>
        </div>
        <Button
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => {
            const label = data.parent.label;
            const q = `Investigate the ${ACCOUNT_LABELS[account]} ${BASIS_LABELS[basis]} variance on ${label}. Decompose the drivers, highlight the top contributors, and call out any pattern worth watching.`;
            router.push(`/ask?q=${encodeURIComponent(q)}`);
          }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Explain this variance
        </Button>
      </div>

      {/* Scope picker */}
      <div className="flex flex-wrap items-center gap-3">
        <ScopePicker value={scope} basePath="/variance" />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/70 bg-background p-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10.5px] uppercase tracking-wide text-muted-foreground mr-1">Metric</span>
          {(Object.keys(ACCOUNT_LABELS) as Account[]).map((a) => (
            <button
              key={a}
              onClick={() => setAccount(a)}
              className={`rounded-md px-2.5 py-1 text-[11.5px] transition border ${
                account === a
                  ? "bg-accent-blue-soft border-accent-blue/40 text-accent-blue font-medium"
                  : "bg-background border-border/60 text-muted-foreground hover:border-border"
              }`}
            >
              {ACCOUNT_LABELS[a]}
            </button>
          ))}
        </div>
        <div className="h-5 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <span className="text-[10.5px] uppercase tracking-wide text-muted-foreground mr-1">Basis</span>
          {(Object.keys(BASIS_LABELS) as Basis[]).map((b) => (
            <button
              key={b}
              onClick={() => setBasis(b)}
              className={`rounded-md px-2.5 py-1 text-[11.5px] transition border ${
                basis === b
                  ? "bg-accent-blue-soft border-accent-blue/40 text-accent-blue font-medium"
                  : "bg-background border-border/60 text-muted-foreground hover:border-border"
              }`}
            >
              {BASIS_LABELS[b]}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-5">
          <div className="min-w-[240px]">
            <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Root variance</div>
            <div className={`text-[22px] font-semibold tabular-nums ${signedClass(data.parent.delta)}`}>
              {formatEurCompact(data.parent.delta)}
            </div>
            <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
              Actual {formatEurCompact(data.parent.valueA)} · Budget {formatEurCompact(data.parent.valueB)}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground mb-1">
              Contribution by child
            </div>
            <ul className="space-y-1.5">
              {data.children.map((c, i) => {
                const widthPct = (Math.abs(c.delta) / maxChildDelta) * 100;
                const material = Math.abs(c.delta) >= thresholdEur;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/variance/${c.id}`}
                      className="group flex items-center gap-3 rounded-md px-2 py-1.5 -mx-2 hover:bg-accent/50 transition"
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${material ? "bg-accent-blue" : "ring-1 ring-border bg-transparent"}`}
                      />
                      <span className="text-[12.5px] flex-1 truncate">{c.label}</span>
                      <div className="h-2 rounded-full bg-muted/70 flex-[2] max-w-[280px] relative overflow-hidden">
                        <motion.div
                          className={`absolute inset-y-0 rounded-full ${
                            c.delta >= 0 ? "bg-positive/60" : "bg-negative/60"
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${widthPct}%` }}
                          transition={{
                            duration: 0.6,
                            delay: i * 0.04,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                        />
                      </div>
                      <span
                        className={`text-[11.5px] tabular-nums w-[70px] text-right ${signedClass(c.delta)}`}
                      >
                        {formatEurCompact(c.delta)}
                      </span>
                      <span className="text-[10.5px] tabular-nums text-muted-foreground w-[42px] text-right">
                        {Math.round(c.deltaShare * 100)}%
                      </span>
                      {c.hasChildren && (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition" />
                      )}
                    </Link>
                  </li>
                );
              })}
              {data.children.length === 0 && (
                <li className="text-[11.5px] text-muted-foreground italic">
                  Leaf entity — no sub-drivers.
                </li>
              )}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
