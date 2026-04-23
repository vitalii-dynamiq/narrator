"use client";

import { CubeCell } from "@/components/cube-cell";
import { VERSIONS, type VersionId } from "@/lib/jedox/schema";
import {
  formatEur,
  formatEurCompact,
  formatPct,
  formatDelta,
  varianceClass,
  favourable,
} from "@/lib/format";
import { useMateriality } from "@/lib/store/materiality";

interface Row {
  id: string;
  label: string;
  indent?: number;
  bold?: boolean;
  isPct?: boolean;
  isBS?: boolean;
  kind: "leaf" | "derived" | "subtotal";
  ytdActual: number | null;
  ytdBudget: number | null;
  ytdPy: number | null;
  ytdMgmtFcst?: number | null;
  ytdPilFcst?: number | null;
  deltaBudget: number | null;
  deltaPctBudget: number | null;
  deltaYoY: number | null;
  deltaPctYoY: number | null;
}

interface Props {
  rows: Row[];
  entity: string;
  ytdPeriod: string;
  ytdPyPeriod: string;
  asOfPeriod: string;
  showForecast?: boolean;
}

export function StatementTable({ rows, entity, ytdPeriod, ytdPyPeriod, asOfPeriod, showForecast }: Props) {
  const { thresholdEur, thresholdPct } = useMateriality();

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full min-w-[820px] text-[12.5px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-2 text-[10.5px] uppercase tracking-wide font-medium text-muted-foreground min-w-[220px]">
              Line item
            </th>
            <th className="text-right px-3 py-2 text-[10.5px] uppercase tracking-wide font-medium text-muted-foreground">
              Actual YTD
            </th>
            <th className="text-right px-3 py-2 text-[10.5px] uppercase tracking-wide font-medium text-muted-foreground">
              Budget
            </th>
            <th className="text-right px-3 py-2 text-[10.5px] uppercase tracking-wide font-medium text-muted-foreground">
              Δ vs Bud
            </th>
            {showForecast && (
              <>
                <th className="text-right px-3 py-2 text-[10.5px] uppercase tracking-wide font-medium text-muted-foreground">
                  Fcst (Mgmt)
                </th>
                <th className="text-right px-3 py-2 text-[10.5px] uppercase tracking-wide font-medium text-muted-foreground">
                  Fcst (PIL)
                </th>
              </>
            )}
            <th className="text-right px-3 py-2 text-[10.5px] uppercase tracking-wide font-medium text-muted-foreground">
              PY YTD
            </th>
            <th className="text-right px-3 py-2 text-[10.5px] uppercase tracking-wide font-medium text-muted-foreground">
              Δ YoY
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const material =
              (r.deltaBudget !== null && Math.abs(r.deltaBudget) >= thresholdEur) ||
              (r.deltaPctBudget !== null && Math.abs(r.deltaPctBudget) >= thresholdPct);
            // Don't dim subtotals / derived lines — they anchor the reader. Only dim pure leaves.
            const shouldDim = !material && r.kind === "leaf" && !r.bold;
            return (
              <tr
                key={r.id}
                className={`group border-b border-border/60 hover:bg-muted/30 transition-colors ${
                  r.bold ? "bg-muted/20" : ""
                } ${shouldDim ? "opacity-40" : ""}`}
              >
                <td
                  className={`px-4 py-1.5 ${r.bold ? "font-semibold" : ""}`}
                  style={{ paddingLeft: `${(r.indent ?? 0) * 12 + 16}px` }}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        material ? "bg-accent-blue" : "bg-transparent ring-1 ring-border"
                      }`}
                      title={material ? "Above materiality threshold" : "Below threshold"}
                    />
                    <span className="truncate">{r.label}</span>
                  </span>
                </td>
                <td className={`text-right px-3 py-1.5 tabular-nums ${r.bold ? "font-semibold" : ""}`}>
                  <CellOrPct
                    value={r.ytdActual}
                    isPct={r.isPct}
                    refArgs={{
                      entity,
                      account: r.id,
                      time: r.isBS ? asOfPeriod : ytdPeriod,
                      version: VERSIONS.Actual,
                    }}
                  />
                </td>
                <td className={`text-right px-3 py-1.5 tabular-nums text-muted-foreground`}>
                  <CellOrPct
                    value={r.ytdBudget}
                    isPct={r.isPct}
                    refArgs={{
                      entity,
                      account: r.id,
                      time: r.isBS ? asOfPeriod : ytdPeriod,
                      version: VERSIONS.Budget2026,
                    }}
                  />
                </td>
                <td className="text-right px-3 py-1.5 tabular-nums">
                  <DeltaChip account={r.id} value={r.deltaBudget} pct={r.deltaPctBudget} isPct={r.isPct} />
                </td>
                {showForecast && (
                  <>
                    <td className="text-right px-3 py-1.5 tabular-nums text-muted-foreground">
                      <CellOrPct
                        value={r.ytdMgmtFcst ?? null}
                        isPct={r.isPct}
                        refArgs={{
                          entity,
                          account: r.id,
                          time: ytdPeriod,
                          version: VERSIONS.MgmtForecastYTG,
                        }}
                      />
                    </td>
                    <td className="text-right px-3 py-1.5 tabular-nums text-muted-foreground">
                      <CellOrPct
                        value={r.ytdPilFcst ?? null}
                        isPct={r.isPct}
                        refArgs={{
                          entity,
                          account: r.id,
                          time: ytdPeriod,
                          version: VERSIONS.PILForecastYTG,
                        }}
                      />
                    </td>
                  </>
                )}
                <td className="text-right px-3 py-1.5 tabular-nums text-muted-foreground">
                  <CellOrPct
                    value={r.ytdPy}
                    isPct={r.isPct}
                    refArgs={{
                      entity,
                      account: r.id,
                      time: r.isBS ? "2025-03" : ytdPyPeriod,
                      version: VERSIONS.Actual,
                    }}
                  />
                </td>
                <td className="text-right px-3 py-1.5 tabular-nums">
                  <DeltaChip account={r.id} value={r.deltaYoY} pct={r.deltaPctYoY} isPct={r.isPct} muted />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CellOrPct({
  value,
  isPct,
  refArgs,
}: {
  value: number | null;
  isPct?: boolean;
  refArgs: { entity: string; account: string; time: string; version: VersionId };
}) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return (
    <CubeCell
      ref_={{ ...refArgs, currency: "EUR", measure: "Value", cube: "FIN_CUBE" }}
      value={value}
      unit={isPct ? "pct" : "eur"}
      compact
      digits={isPct ? 1 : 0}
    />
  );
}

function DeltaChip({
  account,
  value,
  pct,
  isPct,
  muted,
}: {
  /** Account id drives polarity (expense vs income). */
  account: string;
  value: number | null;
  pct: number | null;
  isPct?: boolean;
  muted?: boolean;
}) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const positive = value > 0;
  // Colour by favourability, not raw sign — so +€1M OpEx vs Budget is RED,
  // −€1M OpEx vs Budget is GREEN, and income-side accounts flip.
  const fav = favourable(account, value);
  const bg =
    fav === null
      ? "bg-muted"
      : fav
      ? "bg-positive-soft"
      : "bg-negative-soft";
  const text = varianceClass(account, value);
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 ${bg} ${muted ? "opacity-80" : ""}`}>
      <span className={`${text} font-medium`}>
        {isPct ? `${positive ? "+" : ""}${(value * 100).toFixed(0)}bps` : formatDelta(value, { compact: true })}
      </span>
      {pct !== null && !isPct && (
        <span className={`${text} text-[10.5px] opacity-80`}>
          ({formatPct(pct, { signed: true, digits: 1 })})
        </span>
      )}
    </span>
  );
}
