// UNITY cube schema — dimensions, hierarchies, cubes, and rule metadata
// Designed so every leaf (entity × account × time × version × currency × measure)
// maps to a deterministic cell, and every parent/derivation is computed lazily.

export type DimensionId =
  | "Entity"
  | "Account"
  | "Time"
  | "Version"
  | "Currency"
  | "Measure"
  | "ValuationMethod";

export interface ElementRef {
  dim: DimensionId;
  id: string;
}

/** A cell coordinate in the cube — all dimensions must be present (leaf or aggregate). */
export interface CellRef {
  cube: CubeId;
  entity: string;
  account: string;
  time: string; // e.g. "2026-03", "2026-Q1", "2026", "Y0", "Y1"…
  version: string;
  currency: string; // "EUR" is reporting
  measure: string;
  valuationMethod?: string; // VAL_CUBE only
}

export type CubeId = "FIN_CUBE" | "VAL_CUBE" | "META_CUBE";

export interface Element {
  id: string;
  label: string;
  parent?: string; // id of parent element (in the primary hierarchy)
  /** Parallel hierarchies — element may appear under multiple parents in other trees. */
  secondaryParents?: { hierarchy: string; parent: string }[];
  attrs?: Record<string, string | number | boolean>;
}

export interface Hierarchy {
  id: string; // "primary" or e.g. "Geography", "Industry"
  label: string;
  dim: DimensionId;
  root: string; // root element id
}

export interface Dimension {
  id: DimensionId;
  label: string;
  hierarchies: Hierarchy[];
  elements: Element[]; // flat registry; parent pointers encode hierarchies
}

export interface Cube {
  id: CubeId;
  label: string;
  dims: DimensionId[];
  description: string;
}

// -------------------- Rule AST --------------------

export type Rule =
  | {
      kind: "sum";
      target: ElementRef;
      children: ElementRef[];
      note?: string;
    }
  | {
      kind: "formula";
      target: ElementRef;
      expr: string; // human readable, e.g. "[Revenue] - [COGS] - [OpEx]"
      deps: ElementRef[];
      compute: (deps: number[]) => number;
    }
  | {
      kind: "fx";
      target: ElementRef;
      source: ElementRef;
      rateElement: ElementRef;
    };

// -------------------- Core dimension definitions --------------------

export const ACCOUNT_LEAVES = {
  // P&L
  Revenue_Product: "Revenue_Product",
  Revenue_Services: "Revenue_Services",
  COGS_Material: "COGS_Material",
  COGS_Labor: "COGS_Labor",
  OpEx_SG_A: "OpEx_SG_A",
  OpEx_R_D: "OpEx_R_D",
  OpEx_Marketing: "OpEx_Marketing",
  DA: "DA",
  Interest: "Interest",
  Tax: "Tax",
  // BS
  Cash: "Cash",
  Receivables: "Receivables",
  Inventory: "Inventory",
  PPE: "PPE",
  Goodwill: "Goodwill",
  Payables: "Payables",
  ShortTermDebt: "ShortTermDebt",
  LongTermDebt: "LongTermDebt",
  Equity: "Equity",
  // CF
  CF_Operating: "CF_Operating",
  CF_Investing: "CF_Investing",
  CF_Financing: "CF_Financing",
  CapEx: "CapEx",
  // KPI / operational (leaves)
  Headcount: "Headcount",
  Orders: "Orders",
  ASP: "ASP",
  ARR: "ARR",
} as const;

export type AccountLeaf = (typeof ACCOUNT_LEAVES)[keyof typeof ACCOUNT_LEAVES];

export const ACCOUNT_DERIVED = {
  Revenue: "Revenue",
  COGS: "COGS",
  GrossProfit: "GrossProfit",
  OpEx: "OpEx",
  EBITDA: "EBITDA",
  EBIT: "EBIT",
  NetIncome: "NetIncome",
  GrossMarginPct: "GrossMarginPct",
  EBITDAMarginPct: "EBITDAMarginPct",
  TotalDebt: "TotalDebt",
  NetDebt: "NetDebt",
  TotalAssets: "TotalAssets",
  WorkingCapital: "WorkingCapital",
  FCF: "FCF",
  ROIC: "ROIC",
  RuleOf40: "RuleOf40",
} as const;

export type AccountDerived =
  (typeof ACCOUNT_DERIVED)[keyof typeof ACCOUNT_DERIVED];

// -------------------- Stock vs flow classification --------------------
// Flow accounts (Revenue, EBITDA, CapEx, …) are additive across time — a YTD
// value is the sum of the months in the window. Stock accounts (Cash, Debt,
// Equity, …) are point-in-time snapshots — a YTD value is the end-of-window
// balance, NOT the sum of monthly snapshots (summing would 3× a Q1-YTD cash
// balance). The resolver honours this via `isStockAccount()`.

export const STOCK_LEAVES: ReadonlySet<string> = new Set<string>([
  ACCOUNT_LEAVES.Cash,
  ACCOUNT_LEAVES.Receivables,
  ACCOUNT_LEAVES.Inventory,
  ACCOUNT_LEAVES.PPE,
  ACCOUNT_LEAVES.Goodwill,
  ACCOUNT_LEAVES.Payables,
  ACCOUNT_LEAVES.ShortTermDebt,
  ACCOUNT_LEAVES.LongTermDebt,
  ACCOUNT_LEAVES.Equity,
  // Headcount is a point-in-time count (not a running total of months).
  ACCOUNT_LEAVES.Headcount,
]);

export const STOCK_DERIVED: ReadonlySet<string> = new Set<string>([
  ACCOUNT_DERIVED.TotalDebt,
  ACCOUNT_DERIVED.NetDebt,
  ACCOUNT_DERIVED.TotalAssets,
  ACCOUNT_DERIVED.WorkingCapital,
]);

export function isStockAccount(account: string): boolean {
  return STOCK_LEAVES.has(account) || STOCK_DERIVED.has(account);
}

// -------------------- Account polarity --------------------
// "positive" — higher Actual vs Budget is favourable (Revenue, margins, EBITDA, FCF, Equity).
// "negative" — higher Actual vs Budget is unfavourable (costs, taxes, debt).
// Used by the UI to colour variance deltas correctly: +€1M OpEx vs Budget is
// RED (worse), not green.

export type AccountPolarity = "positive" | "negative";

const NEGATIVE_POLARITY: ReadonlySet<string> = new Set<string>([
  ACCOUNT_LEAVES.COGS_Material,
  ACCOUNT_LEAVES.COGS_Labor,
  ACCOUNT_LEAVES.OpEx_SG_A,
  ACCOUNT_LEAVES.OpEx_R_D,
  ACCOUNT_LEAVES.OpEx_Marketing,
  ACCOUNT_LEAVES.DA,
  ACCOUNT_LEAVES.Interest,
  ACCOUNT_LEAVES.Tax,
  ACCOUNT_LEAVES.CapEx,
  ACCOUNT_LEAVES.ShortTermDebt,
  ACCOUNT_LEAVES.LongTermDebt,
  ACCOUNT_LEAVES.Payables,
  ACCOUNT_DERIVED.COGS,
  ACCOUNT_DERIVED.OpEx,
  ACCOUNT_DERIVED.TotalDebt,
  ACCOUNT_DERIVED.NetDebt,
]);

export function accountPolarity(account: string): AccountPolarity {
  return NEGATIVE_POLARITY.has(account) ? "negative" : "positive";
}

// -------------------- Versions --------------------

export const VERSIONS = {
  Actual: "Actual",
  Budget2026: "Budget-2026",
  Budget2025: "Budget-2025",
  MgmtForecastYTG: "MgmtForecast-YTG",
  PILForecastYTG: "PIL-Forecast-YTG",
  MgmtForecastY1: "MgmtForecast-Y1",
  MgmtForecastY2: "MgmtForecast-Y2",
  MgmtForecastY3: "MgmtForecast-Y3",
  MgmtForecastY4: "MgmtForecast-Y4",
  PILForecastY1: "PIL-Forecast-Y1",
  PILForecastY2: "PIL-Forecast-Y2",
  PILForecastY3: "PIL-Forecast-Y3",
  PILForecastY4: "PIL-Forecast-Y4",
  ValuationV1: "Valuation-V1",
  ValuationV2: "Valuation-V2",
} as const;

export type VersionId = (typeof VERSIONS)[keyof typeof VERSIONS];

// -------------------- Measures --------------------

export const MEASURES = ["Value", "FTE", "Units", "Pct"] as const;
export type MeasureId = (typeof MEASURES)[number];

// -------------------- Valuation methods --------------------

export const VALUATION_METHODS = ["Multiples", "DCF", "NAV"] as const;
export type ValuationMethodId = (typeof VALUATION_METHODS)[number];

// -------------------- Currencies --------------------

export const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "PLN", "SEK"] as const;
export type CurrencyId = (typeof CURRENCIES)[number];
