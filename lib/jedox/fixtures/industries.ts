// Industry profiles — drive growth curves, seasonality, margin shapes, KPI mix.
import type { IndustryTag } from "./portfolios";

export interface IndustryProfile {
  /** Annualized revenue CAGR for first 12 months of the 36-month window. */
  cagrY0: number;
  /** Annualized revenue CAGR applied months 13–24. */
  cagrY1: number;
  /** Annualized revenue CAGR applied months 25–36. */
  cagrY2: number;
  /** 12-element array summing to 12 — monthly index applied over each year's base. */
  seasonality: number[];
  /** Starting gross margin (as decimal). */
  grossMarginStart: number;
  /** Annualized GM drift (decimal per year). */
  grossMarginDrift: number;
  /** OpEx as share of revenue — starting. */
  opexRatioStart: number;
  /** Annualized change in OpEx ratio (typically negative as scale improves). */
  opexRatioDrift: number;
  /** Monthly AR(1) noise standard deviation on revenue (decimal). */
  revNoise: number;
  /** Capital intensity (CapEx as % of revenue). */
  capexRatio: number;
  /** EV/EBITDA multiple used in valuation fixture (trailing). */
  evEbitdaMultiple: number;
  /** Inventory days on revenue (for BS generation). */
  inventoryDays: number;
  /** Receivables days on revenue. */
  receivablesDays: number;
  /** Payables days on revenue. */
  payablesDays: number;
  /** Normalized headcount per €m of revenue. */
  fteDensity: number;
}

const FLAT_SEASONALITY = new Array(12).fill(1);

const Q4_HEAVY: number[] = [0.82, 0.85, 0.92, 0.95, 0.98, 0.96, 0.95, 0.92, 1.02, 1.08, 1.22, 1.33];
const Q2_HEAVY: number[] = [0.92, 0.95, 1.02, 1.1, 1.16, 1.18, 1.08, 0.93, 0.94, 0.95, 0.88, 0.89];
const Q1_HEAVY: number[] = [1.18, 1.16, 1.1, 1.05, 0.98, 0.95, 0.92, 0.9, 0.95, 0.96, 0.94, 0.91];

function normalize(arr: number[]) {
  const sum = arr.reduce((a, b) => a + b, 0);
  return arr.map((x) => (x * 12) / sum);
}

export const INDUSTRY_PROFILES: Record<IndustryTag, IndustryProfile> = {
  IndustrialPackaging: {
    cagrY0: 0.11,
    cagrY1: 0.06,
    cagrY2: 0.03,
    seasonality: normalize([0.95, 0.95, 1.02, 1.04, 1.06, 1.04, 1.0, 0.96, 1.02, 1.04, 1.0, 0.92]),
    grossMarginStart: 0.285,
    grossMarginDrift: -0.015,
    opexRatioStart: 0.11,
    opexRatioDrift: -0.003,
    revNoise: 0.022,
    capexRatio: 0.045,
    evEbitdaMultiple: 7.2,
    inventoryDays: 62,
    receivablesDays: 58,
    payablesDays: 45,
    fteDensity: 2.1,
  },
  SaaS: {
    cagrY0: 0.32,
    cagrY1: 0.26,
    cagrY2: 0.18,
    seasonality: FLAT_SEASONALITY,
    grossMarginStart: 0.78,
    grossMarginDrift: 0.012,
    opexRatioStart: 0.62,
    opexRatioDrift: -0.04,
    revNoise: 0.015,
    capexRatio: 0.015,
    evEbitdaMultiple: 18.5,
    inventoryDays: 0,
    receivablesDays: 42,
    payablesDays: 35,
    fteDensity: 3.8,
  },
  SpecialtyChemicals: {
    cagrY0: 0.04,
    cagrY1: 0.06,
    cagrY2: 0.07,
    seasonality: normalize(Q2_HEAVY),
    grossMarginStart: 0.36,
    grossMarginDrift: 0.008,
    opexRatioStart: 0.14,
    opexRatioDrift: -0.004,
    revNoise: 0.018,
    capexRatio: 0.06,
    evEbitdaMultiple: 9.0,
    inventoryDays: 85,
    receivablesDays: 68,
    payablesDays: 52,
    fteDensity: 1.4,
  },
  HealthcareServices: {
    cagrY0: 0.08,
    cagrY1: 0.07,
    cagrY2: 0.09,
    seasonality: normalize([0.94, 0.92, 1.04, 1.02, 1.04, 1.02, 0.96, 0.9, 1.02, 1.08, 1.06, 1.0]),
    grossMarginStart: 0.41,
    grossMarginDrift: 0.006,
    opexRatioStart: 0.22,
    opexRatioDrift: -0.006,
    revNoise: 0.014,
    capexRatio: 0.05,
    evEbitdaMultiple: 11.5,
    inventoryDays: 12,
    receivablesDays: 48,
    payablesDays: 32,
    fteDensity: 5.8,
  },
  Logistics: {
    cagrY0: 0.07,
    cagrY1: 0.08,
    cagrY2: 0.09,
    seasonality: normalize(Q4_HEAVY),
    grossMarginStart: 0.22,
    grossMarginDrift: 0.005,
    opexRatioStart: 0.09,
    opexRatioDrift: -0.002,
    revNoise: 0.028,
    capexRatio: 0.08,
    evEbitdaMultiple: 10.5,
    inventoryDays: 6,
    receivablesDays: 44,
    payablesDays: 30,
    fteDensity: 2.6,
  },
  BrandedFood: {
    cagrY0: 0.04,
    cagrY1: 0.05,
    cagrY2: 0.05,
    seasonality: normalize(Q4_HEAVY),
    grossMarginStart: 0.34,
    grossMarginDrift: 0.002,
    opexRatioStart: 0.18,
    opexRatioDrift: -0.003,
    revNoise: 0.019,
    capexRatio: 0.04,
    evEbitdaMultiple: 12.0,
    inventoryDays: 58,
    receivablesDays: 40,
    payablesDays: 38,
    fteDensity: 2.0,
  },
  Fintech: {
    cagrY0: 0.42,
    cagrY1: 0.34,
    cagrY2: 0.24,
    seasonality: FLAT_SEASONALITY,
    grossMarginStart: 0.68,
    grossMarginDrift: 0.02,
    opexRatioStart: 0.74,
    opexRatioDrift: -0.06,
    revNoise: 0.025,
    capexRatio: 0.02,
    evEbitdaMultiple: 22.0,
    inventoryDays: 0,
    receivablesDays: 38,
    payablesDays: 28,
    fteDensity: 4.5,
  },
  DigitalHealth: {
    cagrY0: 0.28,
    cagrY1: 0.24,
    cagrY2: 0.18,
    seasonality: FLAT_SEASONALITY,
    grossMarginStart: 0.65,
    grossMarginDrift: 0.015,
    opexRatioStart: 0.58,
    opexRatioDrift: -0.04,
    revNoise: 0.022,
    capexRatio: 0.025,
    evEbitdaMultiple: 16.0,
    inventoryDays: 0,
    receivablesDays: 52,
    payablesDays: 34,
    fteDensity: 4.2,
  },
  Media: {
    cagrY0: 0.15,
    cagrY1: 0.12,
    cagrY2: 0.09,
    seasonality: normalize([0.92, 0.9, 0.95, 1.0, 1.02, 1.04, 1.0, 0.96, 1.04, 1.08, 1.06, 1.03]),
    grossMarginStart: 0.48,
    grossMarginDrift: 0.005,
    opexRatioStart: 0.32,
    opexRatioDrift: -0.008,
    revNoise: 0.02,
    capexRatio: 0.03,
    evEbitdaMultiple: 11.0,
    inventoryDays: 0,
    receivablesDays: 55,
    payablesDays: 38,
    fteDensity: 3.4,
  },
  ProfServices: {
    cagrY0: 0.12,
    cagrY1: 0.1,
    cagrY2: 0.08,
    seasonality: normalize(Q1_HEAVY),
    grossMarginStart: 0.38,
    grossMarginDrift: 0.004,
    opexRatioStart: 0.2,
    opexRatioDrift: -0.005,
    revNoise: 0.018,
    capexRatio: 0.015,
    evEbitdaMultiple: 9.5,
    inventoryDays: 0,
    receivablesDays: 62,
    payablesDays: 24,
    fteDensity: 6.2,
  },
  Retail: {
    cagrY0: -0.02,
    cagrY1: 0.03,
    cagrY2: 0.05,
    seasonality: normalize(Q4_HEAVY),
    grossMarginStart: 0.31,
    grossMarginDrift: 0.015,
    opexRatioStart: 0.24,
    opexRatioDrift: -0.01,
    revNoise: 0.03,
    capexRatio: 0.04,
    evEbitdaMultiple: 6.5,
    inventoryDays: 78,
    receivablesDays: 22,
    payablesDays: 45,
    fteDensity: 4.8,
  },
  EnergyTransition: {
    cagrY0: 0.38,
    cagrY1: 0.3,
    cagrY2: 0.22,
    seasonality: normalize([1.06, 1.08, 1.02, 0.94, 0.9, 0.88, 0.88, 0.92, 0.96, 1.02, 1.08, 1.12]),
    grossMarginStart: 0.26,
    grossMarginDrift: 0.012,
    opexRatioStart: 0.18,
    opexRatioDrift: -0.005,
    revNoise: 0.034,
    capexRatio: 0.2,
    evEbitdaMultiple: 14.0,
    inventoryDays: 32,
    receivablesDays: 58,
    payablesDays: 42,
    fteDensity: 2.8,
  },
  MediaTurnaround: {
    cagrY0: -0.08,
    cagrY1: -0.02,
    cagrY2: 0.04,
    seasonality: normalize([0.94, 0.92, 0.95, 1.0, 1.02, 1.02, 0.98, 0.94, 1.04, 1.08, 1.06, 1.05]),
    grossMarginStart: 0.35,
    grossMarginDrift: 0.02,
    opexRatioStart: 0.3,
    opexRatioDrift: -0.015,
    revNoise: 0.026,
    capexRatio: 0.025,
    evEbitdaMultiple: 8.0,
    inventoryDays: 0,
    receivablesDays: 60,
    payablesDays: 38,
    fteDensity: 3.8,
  },
};

// FX rates — used to translate local-currency values into EUR reporting.
export const FX_TO_EUR: Record<"EUR" | "USD" | "GBP" | "CHF" | "PLN" | "SEK", number> = {
  EUR: 1,
  USD: 0.93,
  GBP: 1.16,
  CHF: 1.04,
  PLN: 0.234,
  SEK: 0.087,
};
