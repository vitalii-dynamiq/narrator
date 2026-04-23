"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { useMateriality } from "@/lib/store/materiality";
import { Filter } from "lucide-react";
import { formatEurCompact } from "@/lib/format";

const STEPS_EUR = [
  50_000, 100_000, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000, 25_000_000,
];

export function MaterialityDial() {
  const { thresholdEur, thresholdPct, set } = useMateriality();
  const idx = Math.max(0, STEPS_EUR.findIndex((v) => v >= thresholdEur));

  return (
    <Popover>
      <PopoverTrigger className="flex items-center gap-1.5 rounded-md border border-border/80 bg-background px-2 py-1 text-[11px] hover:border-border transition">
        <Filter className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground">Materiality</span>
        <span className="tabular-nums font-medium">{formatEurCompact(thresholdEur)}</span>
        <span className="text-muted-foreground">/ {(thresholdPct * 100).toFixed(1)}%</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-muted-foreground">Min absolute</label>
              <span className="text-[12px] font-medium tabular-nums">
                {formatEurCompact(thresholdEur)}
              </span>
            </div>
            <Slider
              className="mt-2"
              min={0}
              max={STEPS_EUR.length - 1}
              step={1}
              value={[idx < 0 ? 0 : idx]}
              onValueChange={(v) => {
                const i = Array.isArray(v) ? v[0] : v;
                set(STEPS_EUR[i], thresholdPct);
              }}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-muted-foreground">Min %</label>
              <span className="text-[12px] font-medium tabular-nums">
                {(thresholdPct * 100).toFixed(1)}%
              </span>
            </div>
            <Slider
              className="mt-2"
              min={0}
              max={15}
              step={1}
              value={[Math.round(thresholdPct * 100)]}
              onValueChange={(v) => {
                const i = Array.isArray(v) ? v[0] : v;
                set(thresholdEur, i / 100);
              }}
            />
          </div>
          <p className="text-[10.5px] leading-tight text-muted-foreground">
            Lines with |Δ| ≥ absolute <strong>OR</strong> |Δ%| ≥ % are considered material at this level.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
