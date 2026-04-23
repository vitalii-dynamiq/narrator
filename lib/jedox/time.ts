// Time utilities — all periods are "YYYY-MM" (monthly), "YYYY-QN" (quarterly), or "YYYY" (annual).
// The "current period" is March 2026 (month index 35 in the 36-month actuals window).

export const DEMO_CURRENT_PERIOD = "2026-03";
export const DEMO_CURRENT_YEAR = 2026;
/** Month index of the current period inside the 36-month window. */
export const DEMO_CURRENT_INDEX = 35;

/** Start of the 36-month actuals window = April 2023. */
export const DEMO_WINDOW_START_YEAR = 2023;
export const DEMO_WINDOW_START_MONTH = 4;

export function monthIndexToPeriod(i: number): string {
  // i = 0 → 2023-04
  const absolute = DEMO_WINDOW_START_MONTH + i; // 1-based from Jan of start year
  const year = DEMO_WINDOW_START_YEAR + Math.floor((absolute - 1) / 12);
  const month = ((absolute - 1) % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function periodToMonthIndex(period: string): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return (year - DEMO_WINDOW_START_YEAR) * 12 + (month - DEMO_WINDOW_START_MONTH);
}

export function monthsInWindow(startIndex: number, endIndex: number): string[] {
  const out: string[] = [];
  for (let i = startIndex; i <= endIndex; i++) out.push(monthIndexToPeriod(i));
  return out;
}

export function periodToQuarter(period: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return null;
  const month = Number(m[2]);
  const q = Math.ceil(month / 3);
  return `${m[1]}-Q${q}`;
}

export function periodToYear(period: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return m?.[1] ?? period.slice(0, 4);
  return m[1];
}

export const ACTUAL_PERIODS = monthsInWindow(0, 35); // 36 months
export const YTG_MONTH_INDICES = [36, 37, 38, 39, 40, 41, 42, 43, 44]; // Apr-Dec 2026
export const YTG_PERIODS = YTG_MONTH_INDICES.map(monthIndexToPeriod);
export const BUDGET_2026_MONTHLY_PERIODS = [
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
export const BUDGET_2025_MONTHLY_PERIODS = [
  "2025-01",
  "2025-02",
  "2025-03",
  "2025-04",
  "2025-05",
  "2025-06",
  "2025-07",
  "2025-08",
  "2025-09",
  "2025-10",
  "2025-11",
  "2025-12",
];
export const FORWARD_YEARS = ["2027", "2028", "2029", "2030"];

export function isCurrentYear(period: string): boolean {
  return period.startsWith(`${DEMO_CURRENT_YEAR}-`);
}

export function isPriorYear(period: string): boolean {
  return period.startsWith(`${DEMO_CURRENT_YEAR - 1}-`);
}

export function formatPeriodHuman(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  const q = /^(\d{4})-Q(\d)$/.exec(period);
  if (q) return `Q${q[2]} ${q[1]}`;
  return period;
}
