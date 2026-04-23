// Number and date formatters for the UI layer.

export function formatEur(value: number | null | undefined, opts?: { digits?: number; compact?: boolean }): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const digits = opts?.digits ?? 0;
  if (opts?.compact) {
    const abs = Math.abs(value);
    if (abs >= 1e9) return `€${(value / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `€${(value / 1e6).toFixed(abs >= 1e7 ? 1 : 2)}M`;
    if (abs >= 1e3) return `€${(value / 1e3).toFixed(0)}k`;
    return `€${value.toFixed(0)}`;
  }
  return `€${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)}`;
}

export function formatEurCompact(value: number | null | undefined): string {
  return formatEur(value, { compact: true });
}

export function formatDelta(value: number | null | undefined, opts?: { compact?: boolean }): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const prefix = value > 0 ? "+" : value < 0 ? "" : "";
  return `${prefix}${formatEur(value, { compact: opts?.compact ?? true })}`;
}

export function formatPct(
  value: number | null | undefined,
  opts?: { digits?: number; signed?: boolean }
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const digits = opts?.digits ?? 1;
  const sign = opts?.signed ? (value > 0 ? "+" : "") : "";
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

export function formatBps(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value * 10_000)}bps`;
}

export function formatNumber(value: number | null | undefined, opts?: { digits?: number }): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const digits = opts?.digits ?? 0;
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function signedClass(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "text-muted-foreground";
  if (value > 0) return "text-positive";
  if (value < 0) return "text-negative";
  return "text-muted-foreground";
}

/**
 * Classify an account by its natural unit. Percent-valued accounts are stored
 * as decimals in the cube (EBITDAMarginPct = 0.119), so EUR formatting rounds
 * them to €0 — this tags the rendering layer to use the right unit.
 */
export type AccountUnit = "eur" | "percent" | "multiple" | "count" | "ratio";

export function accountUnit(account: string): AccountUnit {
  // Explicit suffixes first.
  if (/Pct$|Percent$|MarginPct$/i.test(account)) return "percent";
  if (/^Multiple$|^RuleOf40$|^ROIC$/i.test(account)) return "ratio";
  // Count-like.
  if (/Headcount|Orders/.test(account)) return "count";
  // Valuation multiple itself.
  if (account === "Multiple") return "multiple";
  // Default — every monetary account (Revenue, EBITDA, FairValue, NetDebt, CF_*, Bridge:*).
  return "eur";
}

/**
 * Format a value for display according to its account's natural unit.
 * Keeps € for money, % for margin ratios, × for multiples, plain count for
 * headcount/orders.
 */
export function formatCellValue(
  value: number | null | undefined,
  account: string,
  opts: { compact?: boolean; digits?: number } = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const unit = accountUnit(account);
  switch (unit) {
    case "percent":
      return formatPct(value, { digits: opts.digits ?? 1 });
    case "multiple":
      return `${value.toFixed(1)}×`;
    case "ratio":
      // ROIC and RuleOf40 in the cube are decimals too.
      return formatPct(value, { digits: opts.digits ?? 1 });
    case "count":
      return formatNumber(value, { digits: 0 });
    default:
      return formatEur(value, { compact: opts.compact ?? false, digits: opts.digits ?? 0 });
  }
}

export function formatCellValueCompact(
  value: number | null | undefined,
  account: string
): string {
  return formatCellValue(value, account, { compact: true });
}

export function unitLabel(account: string): string {
  const unit = accountUnit(account);
  if (unit === "percent" || unit === "ratio") return "%";
  if (unit === "multiple") return "×";
  if (unit === "count") return "";
  return "EUR";
}

/**
 * Pick a sensible Y-axis domain for a time-series chart so that percent and
 * ratio accounts don't render as a sub-pixel flat line. For € / count
 * accounts Recharts' auto-scale is fine (a 10× range is not sub-pixel).
 *
 * The window is data-aware: we pad [min, max] by 10% of the series range
 * (floored at 50bps for percent accounts so a stable margin shows some
 * breathing room instead of zooming into noise).
 */
import { accountPolarity } from "@/lib/jedox/schema";

/**
 * Is a given delta favourable for this account? For positive-polarity accounts
 * (Revenue, EBITDA, margin, Equity), favourable = delta > 0. For negative-
 * polarity ones (OpEx, COGS, Tax, NetDebt, …), favourable = delta < 0. Zero
 * is neutral. Use this to colour variance cells in the statement table — a
 * +€1M OpEx vs Budget is RED (worse), not green.
 */
export function favourable(account: string, delta: number): boolean | null {
  if (delta === 0 || !Number.isFinite(delta)) return null;
  return accountPolarity(account) === "positive" ? delta > 0 : delta < 0;
}

/** Tailwind class for a variance cell based on polarity. */
export function varianceClass(account: string, delta: number | null | undefined): string {
  if (delta == null || !Number.isFinite(delta) || delta === 0) return "text-muted-foreground";
  const fav = favourable(account, delta);
  return fav === null ? "text-muted-foreground" : fav ? "text-positive" : "text-negative";
}

export function chartDomain(
  account: string,
  series: Array<{ value: number } | number>
): [number, number] | undefined {
  const unit = accountUnit(account);
  if (unit !== "percent" && unit !== "ratio" && unit !== "multiple") {
    // EUR / count: let Recharts decide.
    return undefined;
  }
  const values = series
    .map((s) => (typeof s === "number" ? s : s.value))
    .filter((v): v is number => Number.isFinite(v));
  if (values.length === 0) return undefined;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const floor = unit === "multiple" ? 0.5 : 0.005; // 50 bps min window for %
  const pad = Math.max(range * 0.1, floor / 2);
  return [min - pad, max + pad];
}
