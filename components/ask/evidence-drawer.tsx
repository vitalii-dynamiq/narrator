"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Search,
  X,
  GitBranch,
  FileDigit,
  Database,
  Wand2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useConversationId } from "./conversation-context";
import { LineChart, Line, Tooltip as RTooltip, ResponsiveContainer } from "recharts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { RunState, SectionCitation } from "@/lib/agents/events";
import type { CellRef } from "@/lib/jedox/schema";
import { formatCellValue, formatCellValueCompact, unitLabel } from "@/lib/format";
import { formatPeriodHuman } from "@/lib/jedox/time";
import { encodeCellRef } from "@/lib/jedox/engine";

// An evidence row — one unique (entity, account, period, version) pair
// referenced by at least one section in the active conversation. Value comes
// from the first citation that referred to it; derivation / history / rule
// come from the /api/cubes endpoint on click.
interface EvidenceRow {
  key: string;
  entity: string;
  account: string;
  period: string;
  version: string;
  value: number;
  // Which section ids referenced this cell, in order seen.
  refs: Array<{ sectionId: string; citeId: number }>;
}

const FILTERS: Array<{ id: string; label: string; match: (r: EvidenceRow) => boolean }> = [
  { id: "all", label: "All", match: () => true },
  {
    id: "income",
    label: "Income",
    match: (r) =>
      /^(Revenue|Gross|EBITDA|EBIT|NetIncome|COGS|OpEx|DA|Interest|Tax|Margin)/i.test(r.account),
  },
  {
    id: "balance",
    label: "Balance Sheet",
    match: (r) =>
      /^(Cash|Receivables|Inventory|PPE|Goodwill|Payables|Debt|Equity|WorkingCapital|Total)/i.test(
        r.account
      ) || r.account === "NetDebt",
  },
  {
    id: "cashflow",
    label: "Cash Flow",
    match: (r) => /^(FCF|CF_|CapEx)/i.test(r.account),
  },
  {
    id: "valuation",
    label: "Valuation",
    match: (r) =>
      /^(FairValue|Multiple|Bridge:)/i.test(r.account) ||
      /^Valuation-/i.test(r.version),
  },
];

function aggregateEvidence(runs: Array<RunState | undefined>): EvidenceRow[] {
  const byKey = new Map<string, EvidenceRow>();
  for (const run of runs) {
    if (!run) continue;
    const sections = Object.values(run.sections).sort((a, b) => a.order - b.order);
    for (const sec of sections) {
      for (const cite of sec.citations ?? []) {
        const key = `${cite.entity}|${cite.account}|${cite.period}|${cite.version}`;
        const existing = byKey.get(key);
        if (existing) {
          existing.refs.push({ sectionId: sec.id, citeId: cite.id });
        } else {
          byKey.set(key, {
            key,
            entity: cite.entity,
            account: cite.account,
            period: cite.period,
            version: cite.version,
            value: cite.value,
            refs: [{ sectionId: sec.id, citeId: cite.id }],
          });
        }
      }
    }
  }
  return [...byKey.values()];
}

function entityLabel(entityId: string): string {
  // Trim prefixes for display. PE partners shouldn't see ENT_/PRJ_/CG_ noise.
  return entityId.replace(/^(ENT_|PRJ_|CG_)/, "").replace(/_/g, " ");
}

function accountLabel(a: string): string {
  if (a.startsWith("Bridge:")) {
    const leg = a.slice("Bridge:".length);
    return `Bridge · ${leg.charAt(0).toUpperCase()}${leg.slice(1)}`;
  }
  return a;
}

export function EvidenceDrawer({
  open,
  onOpenChange,
  runs,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  runs: Array<RunState | undefined>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const rows = useMemo(() => aggregateEvidence(runs), [runs]);
  const filtered = useMemo(() => {
    const lower = query.trim().toLowerCase();
    const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[0];
    return rows
      .filter((r) => f.match(r))
      .filter((r) => {
        if (!lower) return true;
        return (
          r.entity.toLowerCase().includes(lower) ||
          r.account.toLowerCase().includes(lower) ||
          r.period.toLowerCase().includes(lower) ||
          r.version.toLowerCase().includes(lower) ||
          entityLabel(r.entity).toLowerCase().includes(lower)
        );
      })
      .sort((a, b) => {
        if (a.entity !== b.entity) return a.entity.localeCompare(b.entity);
        return a.account.localeCompare(b.account);
      });
  }, [rows, query, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, EvidenceRow[]>();
    for (const r of filtered) {
      const g = r.entity;
      const arr = map.get(g) ?? [];
      arr.push(r);
      map.set(g, arr);
    }
    return map;
  }, [filtered]);

  const selected = selectedKey ? rows.find((r) => r.key === selectedKey) ?? null : null;

  return (
    <div
      className={`fixed top-[52px] right-0 bottom-0 w-[380px] border-l border-border bg-background shadow-[-4px_0_12px_rgba(0,0,0,0.04)] transition-transform duration-200 z-30 ${
        open ? "translate-x-0" : "translate-x-full"
      } flex flex-col`}
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between px-4 h-11 border-b border-border/80 shrink-0">
        <div className="flex items-center gap-2 text-[12.5px] font-medium">
          <FileText className="h-3.5 w-3.5 text-accent-blue" strokeWidth={2.2} />
          <span>Evidence</span>
          <span className="text-muted-foreground font-normal">
            · {rows.length} cell{rows.length === 1 ? "" : "s"}
          </span>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center"
          aria-label="Close evidence drawer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {selected ? (
        <InlineInspector row={selected} onBack={() => setSelectedKey(null)} />
      ) : (
        <>
          <div className="p-3 space-y-2 shrink-0 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search entity, account, period…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 pl-7 text-[13px]"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  data-filter-chip={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] transition ${
                    filter === f.id
                      ? "bg-accent-blue text-background"
                      : "border border-border/80 text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {rows.length === 0 && (
              <div className="p-8 text-center text-[12.5px] text-muted-foreground italic">
                No references yet. Ask UNITY a question — citations will appear here as sections stream in.
              </div>
            )}
            {rows.length > 0 && filtered.length === 0 && (
              <div className="p-8 text-center text-[12.5px] text-muted-foreground italic">
                No references match that filter.
              </div>
            )}
            {[...grouped.entries()].map(([entity, items]) => (
              <div key={entity} className="border-b border-border/50 last:border-0">
                <div className="px-4 py-1.5 bg-muted/40 text-[10.5px] uppercase tracking-[0.06em] font-medium text-muted-foreground">
                  {entityLabel(entity)}
                  <span className="ml-1 text-muted-foreground/70 font-normal">
                    · {items.length}
                  </span>
                </div>
                <ul>
                  {items.map((r) => (
                    <li key={r.key}>
                      <button
                        onClick={() => setSelectedKey(r.key)}
                        className="w-full text-left px-4 py-2 hover:bg-muted/50 transition flex items-start gap-2.5 border-b border-border/30 last:border-0"
                      >
                        <span className="mt-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded bg-accent-blue-soft text-accent-blue text-[9.5px] font-semibold px-1 shrink-0">
                          {r.refs.length}×
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium truncate">
                            {accountLabel(r.account)}
                          </div>
                          <div className="text-[10.5px] text-muted-foreground font-mono truncate">
                            {formatPeriodHuman(r.period)} · {r.version}
                          </div>
                        </div>
                        <div className="text-right tabular-nums text-[12px] font-semibold text-foreground shrink-0">
                          {formatCellValueCompact(r.value, r.account)}
                        </div>
                        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="px-3 py-2 border-t border-border/60 text-[11px] text-muted-foreground shrink-0 flex items-center justify-between">
            <span>{filtered.length} shown</span>
            {rows.length > 0 && (
              <button
                onClick={() => downloadCsv(rows)}
                className="hover:text-foreground transition underline-offset-2 hover:underline"
              >
                Export CSV
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function downloadCsv(rows: EvidenceRow[]): void {
  const header = ["entity", "account", "period", "version", "value_eur", "referenced_count"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [r.entity, r.account, r.period, r.version, r.value.toFixed(2), r.refs.length].join(",")
    );
  }
  const blob = new Blob([lines.join("\n") + "\n"], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "unity-evidence.csv";
  a.click();
  URL.revokeObjectURL(url);
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

function InlineInspector({ row, onBack }: { row: EvidenceRow; onBack: () => void }) {
  const router = useRouter();
  const conversationId = useConversationId();
  const cellRef: CellRef = {
    cube: "FIN_CUBE",
    entity: row.entity,
    account: row.account,
    time: row.period,
    version: row.version,
    currency: "EUR",
    measure: "Value",
  };
  const coord = encodeCellRef(cellRef);

  const { data, isLoading } = useQuery({
    queryKey: ["cell", coord],
    queryFn: async () => {
      const r = await fetch(`/api/cubes/FIN_CUBE/cells/${coord}`);
      if (!r.ok) throw new Error("Cell fetch failed");
      return (await r.json()) as CellDetail;
    },
    enabled: !!coord,
    staleTime: 60_000,
    retry: false,
  });

  const display = data?.value ?? row.value ?? null;

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="flex items-center gap-2 px-4 h-10 border-b border-border/50 shrink-0 sticky top-0 bg-background z-10">
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onBack}>
          <ChevronLeft className="h-3.5 w-3.5" />
          <span className="ml-1 text-[12px]">Back</span>
        </Button>
      </div>
      <div className="p-4 space-y-4 pb-8">
        <div>
          <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <FileDigit className="h-3 w-3" /> Cube Cell
          </div>
          <div className="text-[17px] font-semibold tracking-tight mt-1">
            {accountLabel(row.account)}
          </div>
          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
            {entityLabel(row.entity)} · {formatPeriodHuman(row.period)} · {row.version}
          </div>
        </div>
        <div>
          <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">Value</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-[26px] font-semibold tracking-tight tabular-nums">
              {display === null ? "—" : formatCellValue(display, row.account)}
            </span>
            <span className="text-[10.5px] text-muted-foreground">
              {unitLabel(row.account) || "EUR"}
            </span>
          </div>
        </div>

        {data?.history && data.history.length > 1 && (
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
              12-month trajectory
            </div>
            <div className="mt-1.5 h-20 rounded-md border border-border bg-background">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.history}
                  margin={{ top: 6, right: 6, bottom: 6, left: 6 }}
                >
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
                      fontSize: 10.5,
                    }}
                    labelFormatter={(v) => formatPeriodHuman(String(v))}
                    formatter={((v: unknown) => [
                      formatCellValueCompact(typeof v === "number" ? v : 0, row.account),
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
            <div className="mt-1 rounded-md border border-accent-blue/30 bg-accent-blue/5 p-2 font-mono text-[11.5px] leading-relaxed">
              {data.ruleMeta.expr}
            </div>
            {data.ruleMeta.deps.length > 0 && (
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
            )}
          </div>
        )}

        {data && data.provenanceCount > 0 && (
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              <Database className="h-3 w-3" />
              Provenance · {data.provenanceCount} leaf{" "}
              {data.provenanceCount === 1 ? "cell" : "cells"}
            </div>
            <ul className="mt-1 max-h-32 space-y-0.5 overflow-y-auto scrollbar-thin rounded-md border border-border">
              {data.provenance.slice(0, 10).map((p, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 border-b border-border/50 px-2 py-1 font-mono text-[10.5px] last:border-0"
                >
                  <span className="text-muted-foreground truncate">{p.entity}</span>
                  <ChevronRight className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{p.account}</span>
                  <ChevronRight className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground shrink-0">{p.time}</span>
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

        {row.refs.length > 0 && (
          <div>
            <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
              Cited in
            </div>
            <ul className="mt-1 space-y-0.5">
              {row.refs.map((ref, i) => (
                <li key={i}>
                  <button
                    className="text-[12px] hover:text-accent-blue transition text-left"
                    onClick={() => {
                      const el = document.getElementById(`section-${ref.sectionId}`);
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    → <span className="font-mono">{ref.sectionId}</span>
                    <span className="text-muted-foreground"> · [cite:{ref.citeId}]</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        <Button
          variant="default"
          className="w-full gap-2 mt-2"
          size="sm"
          onClick={() => {
            const q = `Explain ${accountLabel(row.account)} for ${entityLabel(
              row.entity
            )} at ${formatPeriodHuman(row.period)} (version ${row.version}). What drove it, and what should we watch next quarter?`;
            const params = new URLSearchParams({ q });
            if (conversationId) params.set("conv", conversationId);
            router.push(`/ask?${params.toString()}`);
          }}
        >
          <Wand2 className="h-3.5 w-3.5" />
          Explain this number
        </Button>
      </div>
    </div>
  );
}
