"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ValuationBridge } from "./valuation-bridge";
import { ArrowLeftRight, ScaleIcon, Sparkles } from "lucide-react";
import Link from "next/link";
import { formatEurCompact, formatPct, signedClass } from "@/lib/format";
import type { ValuationBridge as BridgeType } from "@/lib/jedox/valuation";
import { ScopePicker } from "@/components/shell/scope-picker";

interface Response {
  entity: string;
  label: string;
  bridge: BridgeType;
  parent: string | null;
  children: Array<{
    id: string;
    label: string;
    v1Fv: number;
    v2Fv: number;
    delta: number;
    legs: BridgeType["legs"];
  }>;
}

export function ValuationBridgeView({ entityId }: { entityId: string }) {
  const router = useRouter();
  const [swapped, setSwapped] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["valuation", entityId],
    queryFn: async () => {
      const r = await fetch(`/api/valuation/${entityId}`);
      if (!r.ok) throw new Error("valuation fetch failed");
      return (await r.json()) as Response;
    },
  });

  // When swapped, invert the bridge: show V2 → V1 instead of V1 → V2. Must be before any early-return.
  const bridge = data?.bridge;
  const displayBridge = useMemo(() => {
    if (!bridge) return null;
    if (!swapped) return bridge;
    return {
      ...bridge,
      v1: bridge.v2,
      v2: bridge.v1,
      legs: {
        ebitdaEffect: -bridge.legs.ebitdaEffect,
        multipleEffect: -bridge.legs.multipleEffect,
        crossTerm: -bridge.legs.crossTerm,
        leverageEffect: -bridge.legs.leverageEffect,
        fxEffect: -bridge.legs.fxEffect,
        otherEffect: -bridge.legs.otherEffect,
        total: -bridge.legs.total,
      },
    };
  }, [bridge, swapped]);

  if (isLoading || !data || !displayBridge) {
    return (
      <div className="p-6 max-w-[1440px] mx-auto space-y-5">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  const legsOrder: { key: keyof BridgeType["legs"]; label: string; type: "anchor" | "effect" }[] = [
    { key: "total", label: "Total Δ", type: "anchor" },
    { key: "ebitdaEffect", label: "EBITDA", type: "effect" },
    { key: "multipleEffect", label: "Multiple", type: "effect" },
    { key: "crossTerm", label: "Cross", type: "effect" },
    { key: "leverageEffect", label: "Leverage", type: "effect" },
    { key: "fxEffect", label: "FX", type: "effect" },
    { key: "otherEffect", label: "Other", type: "effect" },
  ];

  const totalPct = displayBridge.v1.fv ? displayBridge.legs.total / Math.abs(displayBridge.v1.fv) : 0;

  return (
    <div className="p-6 pb-10 max-w-[1440px] mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <ScaleIcon className="h-3 w-3" />
            Fair Valuation Bridge
          </div>
          <h1 className="text-[24px] font-semibold tracking-tight mt-1">{data.label}</h1>
          <p className="text-[12.5px] text-muted-foreground mt-1">
            <span className="font-mono text-foreground">{displayBridge.v1.period}</span> →{" "}
            <span className="font-mono text-foreground">{displayBridge.v2.period}</span> · EV/EBITDA
            method primary · reporting currency EUR
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => router.push(`/entity/${entityId}`)}
          >
            ← {data.label}
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => {
              const q = `Generate Fair Valuation Commentary for ${data.label}. Walk the V1→V2 bridge leg by leg.`;
              router.push(`/ask?q=${encodeURIComponent(q)}`);
            }}
          >
            <Sparkles className="h-3.5 w-3.5" /> Generate FV Commentary
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ScopePicker value={entityId} basePath="/valuation" />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-8 p-5">
          <div className="mb-1 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[13px] font-semibold">Bridge decomposition</div>
              <div className="text-[11px] text-muted-foreground">
                V2 − V1 = ΔEBITDA·M₁ + EBITDA₂·ΔM + cross + ΔLeverage + ΔFX + Other
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="text-muted-foreground">
                    {swapped ? "V2" : "V1"}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatEurCompact(displayBridge.v1.fv)}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-muted-foreground">
                    {swapped ? "V1" : "V2"}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatEurCompact(displayBridge.v2.fv)}
                  </span>
                </div>
                <div
                  className={`text-[11px] tabular-nums ${signedClass(displayBridge.legs.total)}`}
                >
                  {formatEurCompact(displayBridge.legs.total)} (
                  {formatPct(totalPct, { signed: true })})
                </div>
              </div>
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 shrink-0"
                onClick={() => setSwapped((s) => !s)}
                title="Swap V1 ↔ V2"
                aria-label="Swap V1 and V2"
              >
                <ArrowLeftRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <ValuationBridge bridge={displayBridge} />
          </div>
        </Card>

        <div className="col-span-12 lg:col-span-4 space-y-3">
          <Card className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5">
              Version parameters
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]">
              <div className="text-muted-foreground">LTM EBITDA {swapped ? "V2" : "V1"}</div>
              <div className="text-right tabular-nums">
                {formatEurCompact(displayBridge.v1.ebitda * displayBridge.v1.fx)}
              </div>
              <div className="text-muted-foreground">LTM EBITDA {swapped ? "V1" : "V2"}</div>
              <div className="text-right tabular-nums">
                {formatEurCompact(displayBridge.v2.ebitda * displayBridge.v2.fx)}
              </div>
              <div className="text-muted-foreground">Multiple {swapped ? "V2" : "V1"}</div>
              <div className="text-right tabular-nums">
                {displayBridge.v1.multiple.toFixed(1)}×
              </div>
              <div className="text-muted-foreground">Multiple {swapped ? "V1" : "V2"}</div>
              <div className="text-right tabular-nums">
                {displayBridge.v2.multiple.toFixed(1)}×
              </div>
              <div className="text-muted-foreground">Net Debt {swapped ? "V2" : "V1"}</div>
              <div className="text-right tabular-nums">
                {formatEurCompact(displayBridge.v1.netDebt * displayBridge.v1.fx)}
              </div>
              <div className="text-muted-foreground">Net Debt {swapped ? "V1" : "V2"}</div>
              <div className="text-right tabular-nums">
                {formatEurCompact(displayBridge.v2.netDebt * displayBridge.v2.fx)}
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
              Bridge legs
            </div>
            <ul className="space-y-1.5 text-[11.5px]">
              {legsOrder
                .filter((l) => l.type === "effect")
                .map((leg) => {
                  const value = displayBridge.legs[leg.key] as number;
                  return (
                    <li key={leg.key} className="flex items-center justify-between">
                      <span>{leg.label}</span>
                      <span className={`tabular-nums font-medium ${signedClass(value)}`}>
                        {formatEurCompact(value)}
                      </span>
                    </li>
                  );
                })}
              <li className="pt-1.5 border-t border-border mt-1.5 flex items-center justify-between font-semibold">
                <span>Total</span>
                <span className={`tabular-nums ${signedClass(displayBridge.legs.total)}`}>
                  {formatEurCompact(displayBridge.legs.total)}
                </span>
              </li>
            </ul>
          </Card>

          {data.children.length > 0 && (
            <Card className="p-4">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
                Child entities
              </div>
              <ul className="divide-y divide-border/70">
                {data.children
                  .slice()
                  .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
                  .map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/valuation/${c.id}`}
                        className="flex items-center justify-between py-1.5 -mx-1 px-1 rounded hover:bg-accent/50 transition"
                      >
                        <span className="text-[12px] truncate">{c.label}</span>
                        <span className={`tabular-nums text-[11.5px] ${signedClass(c.delta)}`}>
                          {formatEurCompact(c.delta)}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
