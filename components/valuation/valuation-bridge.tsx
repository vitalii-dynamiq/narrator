"use client";

import { motion } from "framer-motion";
import type { ValuationBridge as BridgeType } from "@/lib/jedox/valuation";
import { formatEurCompact } from "@/lib/format";

interface Bar {
  label: string;
  value: number;
  cumulative: number;
  cumulativeBefore: number;
  kind: "anchor" | "effect";
}

export function ValuationBridge({ bridge }: { bridge: BridgeType }) {
  const legs: Array<{ key: keyof BridgeType["legs"]; label: string }> = [
    { key: "ebitdaEffect", label: "EBITDA" },
    { key: "multipleEffect", label: "Multiple" },
    { key: "crossTerm", label: "Cross" },
    { key: "leverageEffect", label: "Leverage" },
    { key: "fxEffect", label: "FX" },
    { key: "otherEffect", label: "Other" },
  ];

  const bars: Bar[] = [];
  bars.push({
    label: `V1 (${bridge.v1.period})`,
    value: bridge.v1.fv,
    cumulative: bridge.v1.fv,
    cumulativeBefore: 0,
    kind: "anchor",
  });
  let cumulative = bridge.v1.fv;
  for (const l of legs) {
    const v = bridge.legs[l.key] as number;
    bars.push({
      label: l.label,
      value: v,
      cumulative: cumulative + v,
      cumulativeBefore: cumulative,
      kind: "effect",
    });
    cumulative += v;
  }
  bars.push({
    label: `V2 (${bridge.v2.period})`,
    value: bridge.v2.fv,
    cumulative: bridge.v2.fv,
    cumulativeBefore: 0,
    kind: "anchor",
  });

  const minVal = Math.min(0, ...bars.map((b) => Math.min(b.cumulativeBefore, b.cumulative)));
  const maxVal = Math.max(...bars.map((b) => Math.max(b.cumulativeBefore, b.cumulative, b.value)));
  const range = maxVal - minVal || 1;

  const height = 280;
  const padding = 20;

  const toY = (v: number) => padding + ((maxVal - v) / range) * (height - 2 * padding);

  return (
    <div className="w-full">
      <div className="flex items-end gap-2 h-[320px] px-2">
        {bars.map((bar, i) => {
          const anchorTop = toY(bar.value);
          const anchorHeight = height - anchorTop - padding;
          const effectTop = toY(Math.max(bar.cumulativeBefore, bar.cumulative));
          const effectBottom = toY(Math.min(bar.cumulativeBefore, bar.cumulative));
          const effectHeight = Math.max(2, effectBottom - effectTop);
          const isPositive = bar.value > 0;
          const color =
            bar.kind === "anchor"
              ? "var(--foreground)"
              : isPositive
              ? "var(--positive)"
              : "var(--negative)";

          return (
            <div key={i} className="flex flex-col flex-1 items-center min-w-0">
              <div
                className={`text-[10.5px] tabular-nums mb-1 ${
                  bar.kind === "effect" && bar.value < 0
                    ? "text-negative"
                    : bar.kind === "effect" && bar.value > 0
                    ? "text-positive"
                    : "text-foreground font-medium"
                }`}
              >
                {formatEurCompact(bar.value)}
              </div>
              <div className="relative w-full" style={{ height }}>
                <svg className="w-full h-full" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
                  {bar.kind === "anchor" ? (
                    <motion.rect
                      x="20"
                      width="60"
                      initial={{ y: height - padding, height: 0 }}
                      animate={{ y: anchorTop, height: anchorHeight }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: i * 0.05 }}
                      fill={color}
                      opacity={0.9}
                      rx="2"
                    />
                  ) : (
                    <motion.rect
                      x="20"
                      width="60"
                      initial={{ y: toY(bar.cumulativeBefore), height: 0 }}
                      animate={{ y: effectTop, height: effectHeight }}
                      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: i * 0.05 }}
                      fill={color}
                      opacity={0.6}
                      rx="2"
                    />
                  )}
                  {/* Connector line to next bar */}
                  {i < bars.length - 1 && (
                    <motion.line
                      x1="80"
                      x2="100"
                      initial={{ y1: height - padding, y2: height - padding, opacity: 0 }}
                      animate={{
                        y1: toY(bar.cumulative),
                        y2: toY(bar.cumulative),
                        opacity: 0.5,
                      }}
                      transition={{ duration: 0.4, delay: i * 0.05 + 0.2 }}
                      stroke="var(--muted-foreground)"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                  )}
                </svg>
              </div>
              <div className="text-[10.5px] text-muted-foreground text-center mt-1.5 leading-tight truncate w-full">
                {bar.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
