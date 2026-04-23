"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeftRight } from "lucide-react";
import { usePeriodPair } from "@/lib/store/period-pair";
import { VERSIONS, type VersionId } from "@/lib/jedox/schema";
import { formatPeriodHuman, DEMO_CURRENT_PERIOD } from "@/lib/jedox/time";
import { VERSION_LABELS } from "@/lib/jedox/catalog";

const MONTHS_2026 = [
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
  "2026-09",
  "2026-10",
  "2026-11",
  "2026-12",
];
const QUARTERS_2026 = ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"];
const YTD_CURRENT = `YTD-${DEMO_CURRENT_PERIOD}`;

const VERSION_OPTIONS: { id: VersionId; group: string; label: string }[] = [
  { id: VERSIONS.Actual, group: "Actuals", label: VERSION_LABELS[VERSIONS.Actual] },
  { id: VERSIONS.Budget2026, group: "Budget", label: VERSION_LABELS[VERSIONS.Budget2026] },
  { id: VERSIONS.Budget2025, group: "Budget", label: VERSION_LABELS[VERSIONS.Budget2025] },
  { id: VERSIONS.MgmtForecastYTG, group: "Forecast", label: VERSION_LABELS[VERSIONS.MgmtForecastYTG] },
  { id: VERSIONS.PILForecastYTG, group: "Forecast", label: VERSION_LABELS[VERSIONS.PILForecastYTG] },
];

function PairButton({
  which,
  pair,
  onChange,
}: {
  which: "A" | "B";
  pair: { period: string; version: VersionId; label: string };
  onChange: (v: { period: string; version: VersionId; label: string }) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Period ${which}`}
        className="group flex items-center gap-2 rounded-md border border-border/80 bg-background px-2 py-1 text-[12px] hover:border-border transition-colors"
      >
        <span
          className={`rounded-sm px-1 py-0.5 text-[10px] font-semibold tracking-wide ${
            which === "A" ? "bg-accent-blue-soft" : "bg-muted text-muted-foreground"
          }`}
        >
          {which}
        </span>
        <span className="tabular-nums">{formatPeriodHuman(pair.period) || pair.period}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-foreground">{VERSION_LABELS[pair.version] ?? pair.version}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Period</label>
            <Select
              value={pair.period}
              onValueChange={(v) => {
                if (!v) return;
                onChange({
                  ...pair,
                  period: v,
                  label: `${formatPeriodHuman(v)} · ${VERSION_LABELS[pair.version]}`,
                });
              }}
            >
              <SelectTrigger className="mt-1 h-8 w-full text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={YTD_CURRENT}>YTD (through Mar 2026)</SelectItem>
                {QUARTERS_2026.map((q) => (
                  <SelectItem key={q} value={q}>
                    {q}
                  </SelectItem>
                ))}
                {MONTHS_2026.map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatPeriodHuman(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Version</label>
            <Select
              value={pair.version}
              onValueChange={(v) => {
                if (!v) return;
                onChange({
                  ...pair,
                  version: v as VersionId,
                  label: `${formatPeriodHuman(pair.period)} · ${VERSION_LABELS[v]}`,
                });
              }}
            >
              <SelectTrigger className="mt-1 h-8 w-full text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VERSION_OPTIONS.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function PeriodSelector() {
  const { a, b, setA, setB, swap } = usePeriodPair();
  return (
    <div className="flex items-center gap-1.5">
      <PairButton which="A" pair={a} onChange={setA} />
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={swap}
        title="Swap A ↔ B"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
      </Button>
      <PairButton which="B" pair={b} onChange={setB} />
    </div>
  );
}
