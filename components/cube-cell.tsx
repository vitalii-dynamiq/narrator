"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { ChevronRight, Wand2, GitBranch, FileDigit } from "lucide-react";
import { formatEur, formatEurCompact, formatCellValue, unitLabel, accountUnit } from "@/lib/format";
import { formatPeriodHuman } from "@/lib/jedox/time";
import type { CellRef } from "@/lib/jedox/schema";
import { Button } from "@/components/ui/button";
import { useConversationId } from "@/components/ask/conversation-context";

interface Props {
  ref_: Partial<CellRef> & { entity: string; account: string; time: string; version: string };
  value: number | null | undefined;
  className?: string;
  unit?: "eur" | "pct" | "number";
  digits?: number;
  compact?: boolean;
  signed?: boolean;
  children?: ReactNode;
  title?: string;
}

function encodeCoord(ref: CellRef): string {
  if (typeof window === "undefined") return "";
  const json = JSON.stringify(ref);
  return btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function CubeCell({
  ref_,
  value,
  className = "",
  unit,
  digits,
  compact = false,
  signed = false,
  children,
  title,
}: Props) {
  const [open, setOpen] = useState(false);
  const full: CellRef = {
    cube: "FIN_CUBE",
    entity: ref_.entity,
    account: ref_.account,
    time: ref_.time,
    version: ref_.version,
    currency: ref_.currency ?? "EUR",
    measure: ref_.measure ?? "Value",
  };

  // If no explicit unit, infer from the account id so percent accounts
  // (EBITDAMarginPct, GrossMarginPct, ROIC, …) don't render as €0.
  const resolvedUnit =
    unit ?? (accountUnit(ref_.account) === "eur" ? "eur" : "pct");

  let display: string;
  if (children !== undefined) {
    display = "";
  } else if (value === null || value === undefined || Number.isNaN(value)) {
    display = "—";
  } else if (resolvedUnit === "pct") {
    display = formatCellValue(value, ref_.account, { digits: digits ?? 1 });
    if (signed && value > 0) display = `+${display}`;
  } else if (resolvedUnit === "eur") {
    const raw = compact ? formatEurCompact(value) : formatEur(value, { digits });
    display = signed && value > 0 ? `+${raw}` : raw;
  } else {
    display = new Intl.NumberFormat("en-GB").format(value);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={title}
        className={`group inline-flex items-baseline tabular-nums text-left hover:text-accent-blue hover:underline underline-offset-[3px] decoration-dotted transition-colors ${className}`}
      >
        {children ?? display}
      </button>
      {open && (
        <CellInspector
          cellRef={full}
          open={open}
          onOpenChange={setOpen}
          fallbackValue={value ?? null}
        />
      )}
    </>
  );
}

interface CellDetail {
  coord: CellRef;
  value: number;
  currency: string;
  derived: boolean;
  rule?: string;
  provenance: CellRef[];
  provenanceCount: number;
  history: { period: string; value: number }[];
  labels: { entity: string; account: string; version: string };
  ruleMeta: { expr: string; deps: string[] } | null;
}

function CellInspector({
  cellRef,
  open,
  onOpenChange,
  fallbackValue,
}: {
  cellRef: CellRef;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  fallbackValue: number | null;
}) {
  const conversationId = useConversationId();
  const coord = encodeCoord(cellRef);
  const { data, isLoading } = useQuery({
    queryKey: ["cell", coord],
    queryFn: async () => {
      const r = await fetch(`/api/cubes/FIN_CUBE/cells/${coord}`);
      if (!r.ok) throw new Error("Cell fetch failed");
      return (await r.json()) as CellDetail;
    },
    enabled: open && !!coord,
    staleTime: 60_000,
    retry: false,
  });

  const display = data?.value ?? fallbackValue ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[540px] p-0 overflow-y-auto">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-wide text-muted-foreground">
            <FileDigit className="h-3 w-3" />
            Cube Cell · FIN_CUBE
          </div>
          <SheetTitle className="text-[18px] leading-tight pt-1">
            {data?.labels.account ?? cellRef.account}
          </SheetTitle>
          <div className="flex flex-wrap items-center gap-1.5 pt-1.5 text-[11px] text-muted-foreground">
            <span className="truncate">{data?.labels.entity ?? cellRef.entity}</span>
            <ChevronRight className="h-3 w-3" />
            <span>{formatPeriodHuman(cellRef.time)}</span>
            <ChevronRight className="h-3 w-3" />
            <span>{data?.labels.version ?? cellRef.version}</span>
          </div>
        </SheetHeader>

        <div className="p-5 space-y-5">
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Value</div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="text-[28px] font-semibold tracking-tight tabular-nums">
                {display === null ? "—" : formatCellValue(display, cellRef.account)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {unitLabel(cellRef.account) || cellRef.currency}
              </span>
            </div>
          </div>

          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Coordinate</div>
            <div className="mt-1 rounded-md border border-border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed">
              <span className="text-muted-foreground">FIN_CUBE</span> · {cellRef.entity} ·{" "}
              {cellRef.account} · {cellRef.time} · {cellRef.version} · {cellRef.currency} ·{" "}
              {cellRef.measure}
            </div>
          </div>

          {data?.history && data.history.length > 1 && (
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
                12-month trajectory
              </div>
              <div className="mt-2 h-24 rounded-md border border-border bg-background">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.history} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--accent-blue)"
                      strokeWidth={1.5}
                      dot={false}
                    />
                    <RTooltip
                      contentStyle={{
                        background: "white",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                      labelFormatter={(v) => formatPeriodHuman(String(v))}
                      formatter={((v: unknown) => [
                        formatCellValue(typeof v === "number" ? v : 0, cellRef.account, {
                          compact: true,
                        }),
                        "Value",
                      ]) as never}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {data?.ruleMeta && (
            <div>
              <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                <GitBranch className="h-3 w-3" />
                Derivation rule
              </div>
              <div className="mt-1 rounded-md border border-accent-blue/30 bg-accent-blue/5 p-2 font-mono text-[11.5px]">
                {data.ruleMeta.expr}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {data.ruleMeta.deps.map((d) => (
                  <span
                    key={d}
                    className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data && data.provenanceCount > 0 && (
            <div>
              <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
                Provenance · {data.provenanceCount} leaf {data.provenanceCount === 1 ? "cell" : "cells"}
              </div>
              <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto scrollbar-thin rounded-md border border-border">
                {data.provenance.slice(0, 12).map((p, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 border-b border-border/50 px-2 py-1 font-mono text-[10.5px] last:border-0"
                  >
                    <span className="text-muted-foreground">{p.entity}</span>
                    <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />
                    <span>{p.account}</span>
                    <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-muted-foreground">{p.time}</span>
                  </li>
                ))}
                {data.provenance.length < data.provenanceCount && (
                  <li className="px-2 py-1 text-[10.5px] text-muted-foreground">
                    … and {data.provenanceCount - data.provenance.length} more
                  </li>
                )}
              </ul>
            </div>
          )}

          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          <ExplainButton
            cellRef={cellRef}
            label={data?.labels}
            onNavigate={() => onOpenChange(false)}
            conversationId={conversationId}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ExplainButton({
  cellRef,
  label,
  onNavigate,
  conversationId,
}: {
  cellRef: CellRef;
  label?: { entity: string; account: string; version: string };
  onNavigate: () => void;
  /**
   * When present, "Explain this number" continues the active conversation
   * instead of opening a new one. Populated by any caller that's already in
   * a chat session (ask-interface.tsx via the evidence drawer).
   */
  conversationId?: string | null;
}) {
  const router = useRouter();
  return (
    <Button
      variant="default"
      className="w-full gap-2"
      size="sm"
      onClick={() => {
        const entity = label?.entity ?? cellRef.entity;
        const account = label?.account ?? cellRef.account;
        const version = label?.version ?? cellRef.version;
        const humanPeriod = formatPeriodHuman(cellRef.time);
        const q = `Explain ${account} for ${entity} at ${humanPeriod} (version ${version}). What drove it, and what should we watch next quarter?`;
        const params = new URLSearchParams({ q });
        if (conversationId) params.set("conv", conversationId);
        router.push(`/ask?${params.toString()}`);
        onNavigate();
      }}
    >
      <Wand2 className="h-3.5 w-3.5" />
      Explain this number
    </Button>
  );
}
