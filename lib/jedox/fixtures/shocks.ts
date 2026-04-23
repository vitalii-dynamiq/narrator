// Scripted shock events — the narrative "stories" in the demo data.
// Months are 0-indexed from T-36 (oldest) up to T+0 = current period (index 35).

export interface ShockEvent {
  entity: string;
  monthIndex: number; // 0..35
  kind:
    | "revenue_pct" // multiplies revenue from this month onwards
    | "revenue_oneoff" // additive one-time revenue
    | "margin_bps" // shifts gross margin from this month onwards, in bps
    | "opex_oneoff" // additive one-time opex impact
    | "one_off_gain"; // sits in "Other" (not revenue or opex) — used for insurance recoveries etc.
  magnitude: number; // interpretation depends on kind
  label: string;
  /** If true, ends at endMonth; else persists through month 35. */
  endMonth?: number;
}

export const SHOCKS: ShockEvent[] = [
  // Fortuna DE — the underperformer, linerboard ASP compression for final quarter
  {
    entity: "ENT_FORTUNA_DE",
    monthIndex: 33,
    kind: "margin_bps",
    magnitude: -220, // ‑220 bps gross margin
    label: "Linerboard ASP compression (DACH market)",
  },
  {
    entity: "ENT_FORTUNA_DE",
    monthIndex: 33,
    kind: "revenue_pct",
    magnitude: -0.035,
    label: "Volume deferral from key auto-adjacent customer",
  },

  // Vela SE — outperformer, Swedish enterprise landed Q4-25 (~month 30)
  {
    entity: "ENT_VELA_SE",
    monthIndex: 30,
    kind: "revenue_pct",
    magnitude: 0.18,
    label: "Swedish enterprise cohort go-live — ARR step-up",
  },
  {
    entity: "ENT_VELA_SE",
    monthIndex: 30,
    kind: "margin_bps",
    magnitude: 320,
    label: "Operating leverage on enterprise cohort",
  },

  // Orion Lyon — insurance recovery this quarter (month 35)
  {
    entity: "ENT_ORION_LYON",
    monthIndex: 35,
    kind: "one_off_gain",
    magnitude: 6.1, // €6.1M
    label: "Insurance recovery — Lyon facility fire claim (2024)",
  },

  // Helix UK — inflection, CMA-approved tuck-in closed Jan 2026 (~month 34)
  {
    entity: "ENT_HELIX_UK",
    monthIndex: 34,
    kind: "revenue_pct",
    magnitude: 0.08,
    label: "Tuck-in acquisition — ambulatory care platform",
  },
  {
    entity: "ENT_HELIX_UK",
    monthIndex: 34,
    kind: "margin_bps",
    magnitude: 140,
    label: "Post-synergy margin lift",
  },

  // Nimbus Brands — D2C launch bump month 30
  {
    entity: "ENT_NIMBUS_BRANDS",
    monthIndex: 30,
    kind: "revenue_pct",
    magnitude: 0.11,
    label: "D2C platform launch — premium SKU mix",
  },

  // Beacon DE — grid storage contract win month 34
  {
    entity: "ENT_BEACON_DE",
    monthIndex: 34,
    kind: "revenue_pct",
    magnitude: 0.26,
    label: "EnBW grid-services 4-year contract awarded",
  },

  // Kadenza PL — contract loss month 33
  {
    entity: "ENT_KADENZA_PL",
    monthIndex: 33,
    kind: "revenue_pct",
    magnitude: -0.07,
    label: "Loss of Cinepolis licensing renewal",
  },

  // Tribune FR — digital relaunch, OpEx one-off month 32
  {
    entity: "ENT_TRIBUNE_FR",
    monthIndex: 32,
    kind: "opex_oneoff",
    magnitude: 4.2,
    label: "Digital platform relaunch — one-off restructuring",
  },
  {
    entity: "ENT_TRIBUNE_FR",
    monthIndex: 34,
    kind: "revenue_pct",
    magnitude: 0.06,
    label: "Digital subscription traction post-relaunch",
  },

  // Argon IT — legacy store impairment month 35
  {
    entity: "ENT_ARGON_IT",
    monthIndex: 35,
    kind: "opex_oneoff",
    magnitude: 3.8,
    label: "Legacy store network impairment (6 closures)",
  },

  // Solstice DE — take rate expansion month 34
  {
    entity: "ENT_SOLSTICE_DE",
    monthIndex: 34,
    kind: "revenue_pct",
    magnitude: 0.12,
    label: "Take-rate expansion on embedded payments tier",
  },

  // Lumen FR — payer contract month 33
  {
    entity: "ENT_LUMEN_FR",
    monthIndex: 33,
    kind: "revenue_pct",
    magnitude: 0.14,
    label: "CPAM payer reimbursement contract signed",
  },

  // Atlas NL — no operating shock, FV effect handled via multiple expansion
];

export const SHOCKS_BY_ENTITY = SHOCKS.reduce(
  (acc, s) => {
    (acc[s.entity] ??= []).push(s);
    return acc;
  },
  {} as Record<string, ShockEvent[]>
);
