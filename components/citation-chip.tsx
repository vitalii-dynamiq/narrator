"use client";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { CubeCell } from "./cube-cell";
import type { CellRef } from "@/lib/jedox/schema";
import { formatCellValueCompact, unitLabel } from "@/lib/format";
import { formatPeriodHuman } from "@/lib/jedox/time";

interface Props {
  n: number;
  cellRef: CellRef;
  value?: number;
  label?: string;
}

export function CitationChip({ n, cellRef, value, label }: Props) {
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={120}
        closeDelay={0}
        render={
          <CubeCell
            ref_={cellRef}
            value={value ?? null}
            className="ml-0.5 inline-flex items-center h-4 min-w-[16px] justify-center rounded-[3px] bg-accent-blue-soft px-1 text-[9.5px] font-semibold text-accent-blue hover:bg-accent-blue hover:text-background no-underline!"
          >
            {n}
          </CubeCell>
        }
      />

      <HoverCardContent align="start" className="w-80 p-3 text-[11.5px]">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Citation [{n}]</div>
        {label && <div className="pt-0.5 font-medium">{label}</div>}
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[15px] font-semibold tabular-nums">
            {value !== undefined ? formatCellValueCompact(value, cellRef.account) : "—"}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {unitLabel(cellRef.account) || cellRef.currency}
          </span>
        </div>
        <div className="mt-2 rounded border border-border bg-muted/40 p-1.5 font-mono text-[10px] leading-relaxed">
          <span className="text-muted-foreground">FIN_CUBE</span> · {cellRef.entity} ·{" "}
          {cellRef.account} · {formatPeriodHuman(cellRef.time)} · {cellRef.version}
        </div>
        <div className="pt-1.5 text-[10px] text-muted-foreground">
          Click the chip to open the full cube-cell inspector with rule derivation and sparkline.
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
