// Meridiem Capital Partners — portfolio fixture.
// 3 consolidated groups, 13 projects, 38 entities.
// Every entity has: label, project parent, group parent, industry tag, geography, currency, base revenue (LTM at T0), ownership %.

export type IndustryTag =
  | "IndustrialPackaging"
  | "SaaS"
  | "SpecialtyChemicals"
  | "HealthcareServices"
  | "Logistics"
  | "BrandedFood"
  | "Fintech"
  | "DigitalHealth"
  | "Media"
  | "ProfServices"
  | "Retail"
  | "EnergyTransition"
  | "MediaTurnaround";

export type GeographyTag =
  | "DACH"
  | "Nordics"
  | "UK_I"
  | "France"
  | "Benelux"
  | "Italy"
  | "Iberia"
  | "CEE";

export interface EntityFixture {
  id: string;
  label: string;
  project: string;
  group: string;
  industry: IndustryTag;
  geography: GeographyTag;
  localCurrency: "EUR" | "USD" | "GBP" | "CHF" | "PLN" | "SEK";
  /** Starting point base revenue (€m equivalent, at T-36). */
  baseRevenueM: number;
  ownershipPct: number;
  /** Narrative flavor used for demo storytelling. */
  flavor?: string;
}

export interface ProjectFixture {
  id: string;
  label: string;
  group: string;
  thesis: string;
  industry: IndustryTag;
  geography: GeographyTag;
  acquiredYear: number;
}

export interface GroupFixture {
  id: string;
  label: string;
  aumEurM: number;
  mandate: string;
}

export const GROUPS: GroupFixture[] = [
  {
    id: "CG_BUYOUTS",
    label: "Buyouts",
    aumEurM: 2_100,
    mandate: "Mid-market European buyouts, €100–500M enterprise value, 5–7y hold.",
  },
  {
    id: "CG_GROWTH",
    label: "Growth",
    aumEurM: 780,
    mandate: "Growth capital into €10–50M ARR software and tech-enabled services.",
  },
  {
    id: "CG_SPECSIT",
    label: "Special Situations",
    aumEurM: 360,
    mandate: "Complex carve-outs, distressed and turnaround across consumer / industrial.",
  },
];

export const PROJECTS: ProjectFixture[] = [
  // Buyouts
  {
    id: "PRJ_FORTUNA",
    label: "Fortuna",
    group: "CG_BUYOUTS",
    thesis: "DACH-led platform in corrugated & specialty packaging; build-up via 3 tuck-ins by Y5.",
    industry: "IndustrialPackaging",
    geography: "DACH",
    acquiredYear: 2023,
  },
  {
    id: "PRJ_VELA",
    label: "Vela",
    group: "CG_BUYOUTS",
    thesis: "Nordic vertical SaaS for construction SMB; drive NDR above 115%.",
    industry: "SaaS",
    geography: "Nordics",
    acquiredYear: 2024,
  },
  {
    id: "PRJ_ORION",
    label: "Orion",
    group: "CG_BUYOUTS",
    thesis: "French specialty chemicals carve-out from BlueTech SA; margin recovery thesis.",
    industry: "SpecialtyChemicals",
    geography: "France",
    acquiredYear: 2022,
  },
  {
    id: "PRJ_HELIX",
    label: "Helix",
    group: "CG_BUYOUTS",
    thesis: "UK diagnostics roll-up across ambulatory care; platform for IE expansion.",
    industry: "HealthcareServices",
    geography: "UK_I",
    acquiredYear: 2022,
  },
  {
    id: "PRJ_ATLAS",
    label: "Atlas",
    group: "CG_BUYOUTS",
    thesis: "Benelux B2B parcel & e-com fulfillment; route density and automation.",
    industry: "Logistics",
    geography: "Benelux",
    acquiredYear: 2023,
  },
  {
    id: "PRJ_NIMBUS",
    label: "Nimbus",
    group: "CG_BUYOUTS",
    thesis: "Italian premium branded food holdco; international expansion via D2C + grocery.",
    industry: "BrandedFood",
    geography: "Italy",
    acquiredYear: 2021,
  },
  // Growth
  {
    id: "PRJ_SOLSTICE",
    label: "Solstice",
    group: "CG_GROWTH",
    thesis: "Embedded finance platform for DACH/UK SMBs; take-rate expansion.",
    industry: "Fintech",
    geography: "DACH",
    acquiredYear: 2023,
  },
  {
    id: "PRJ_LUMEN",
    label: "Lumen",
    group: "CG_GROWTH",
    thesis: "Tele-health and chronic care SaaS across DE/FR/ES; payer contracts.",
    industry: "DigitalHealth",
    geography: "DACH",
    acquiredYear: 2024,
  },
  {
    id: "PRJ_KADENZA",
    label: "Kadenza",
    group: "CG_GROWTH",
    thesis: "CEE streaming & content licensing; ad + subscription dual rail.",
    industry: "Media",
    geography: "CEE",
    acquiredYear: 2023,
  },
  {
    id: "PRJ_PRAXIS",
    label: "Praxis",
    group: "CG_GROWTH",
    thesis: "Tech-enabled professional services for DACH / Nordic enterprise IT.",
    industry: "ProfServices",
    geography: "DACH",
    acquiredYear: 2024,
  },
  // Special Situations
  {
    id: "PRJ_ARGON",
    label: "Argon",
    group: "CG_SPECSIT",
    thesis: "Distressed Italian specialty retail carve-out; store optimization + digital.",
    industry: "Retail",
    geography: "Italy",
    acquiredYear: 2023,
  },
  {
    id: "PRJ_BEACON",
    label: "Beacon",
    group: "CG_SPECSIT",
    thesis: "Energy transition platform — battery storage & grid services in DE/PL.",
    industry: "EnergyTransition",
    geography: "DACH",
    acquiredYear: 2024,
  },
  {
    id: "PRJ_TRIBUNE",
    label: "Tribune",
    group: "CG_SPECSIT",
    thesis: "Francophone media turnaround — digital-first relaunch, cost reset.",
    industry: "MediaTurnaround",
    geography: "France",
    acquiredYear: 2022,
  },
];

export const ENTITIES: EntityFixture[] = [
  // Fortuna (flagship underperformer)
  {
    id: "ENT_FORTUNA_DE",
    label: "Fortuna DE",
    project: "PRJ_FORTUNA",
    group: "CG_BUYOUTS",
    industry: "IndustrialPackaging",
    geography: "DACH",
    localCurrency: "EUR",
    baseRevenueM: 410,
    ownershipPct: 100,
    flavor: "Flagship corrugated producer; linerboard ASP compression is the Q1 story.",
  },
  {
    id: "ENT_FORTUNA_AT",
    label: "Fortuna AT",
    project: "PRJ_FORTUNA",
    group: "CG_BUYOUTS",
    industry: "IndustrialPackaging",
    geography: "DACH",
    localCurrency: "EUR",
    baseRevenueM: 180,
    ownershipPct: 100,
  },
  {
    id: "ENT_FORTUNA_CH",
    label: "Fortuna CH",
    project: "PRJ_FORTUNA",
    group: "CG_BUYOUTS",
    industry: "IndustrialPackaging",
    geography: "DACH",
    localCurrency: "CHF",
    baseRevenueM: 95,
    ownershipPct: 100,
  },
  // Vela (outperformer)
  {
    id: "ENT_VELA_SE",
    label: "Vela SE",
    project: "PRJ_VELA",
    group: "CG_BUYOUTS",
    industry: "SaaS",
    geography: "Nordics",
    localCurrency: "SEK",
    baseRevenueM: 38,
    ownershipPct: 82,
    flavor: "Swedish enterprise landed in Q4-25; operating leverage thesis is playing out.",
  },
  {
    id: "ENT_VELA_NO",
    label: "Vela NO",
    project: "PRJ_VELA",
    group: "CG_BUYOUTS",
    industry: "SaaS",
    geography: "Nordics",
    localCurrency: "SEK",
    baseRevenueM: 17,
    ownershipPct: 82,
  },
  // Orion (surprise one-off)
  {
    id: "ENT_ORION_LYON",
    label: "Orion Lyon",
    project: "PRJ_ORION",
    group: "CG_BUYOUTS",
    industry: "SpecialtyChemicals",
    geography: "France",
    localCurrency: "EUR",
    baseRevenueM: 230,
    ownershipPct: 100,
    flavor: "€6.1M insurance recovery on the Lyon facility fire claim booked this quarter.",
  },
  {
    id: "ENT_ORION_TLS",
    label: "Orion Toulouse",
    project: "PRJ_ORION",
    group: "CG_BUYOUTS",
    industry: "SpecialtyChemicals",
    geography: "France",
    localCurrency: "EUR",
    baseRevenueM: 140,
    ownershipPct: 100,
  },
  {
    id: "ENT_ORION_HOLD",
    label: "Orion HoldCo",
    project: "PRJ_ORION",
    group: "CG_BUYOUTS",
    industry: "SpecialtyChemicals",
    geography: "France",
    localCurrency: "EUR",
    baseRevenueM: 12,
    ownershipPct: 100,
  },
  // Helix (inflection)
  {
    id: "ENT_HELIX_UK",
    label: "Helix UK",
    project: "PRJ_HELIX",
    group: "CG_BUYOUTS",
    industry: "HealthcareServices",
    geography: "UK_I",
    localCurrency: "GBP",
    baseRevenueM: 170,
    ownershipPct: 88,
    flavor: "First positive EBITDA growth in 3 quarters after CMA-approved tuck-in (Jan 2026).",
  },
  {
    id: "ENT_HELIX_IE",
    label: "Helix IE",
    project: "PRJ_HELIX",
    group: "CG_BUYOUTS",
    industry: "HealthcareServices",
    geography: "UK_I",
    localCurrency: "EUR",
    baseRevenueM: 45,
    ownershipPct: 88,
  },
  // Atlas (FV mover)
  {
    id: "ENT_ATLAS_NL",
    label: "Atlas NL",
    project: "PRJ_ATLAS",
    group: "CG_BUYOUTS",
    industry: "Logistics",
    geography: "Benelux",
    localCurrency: "EUR",
    baseRevenueM: 265,
    ownershipPct: 95,
    flavor: "Comp-set re-rated this quarter — logistics multiples expanded ~1.5x on sector tailwind.",
  },
  {
    id: "ENT_ATLAS_BE",
    label: "Atlas BE",
    project: "PRJ_ATLAS",
    group: "CG_BUYOUTS",
    industry: "Logistics",
    geography: "Benelux",
    localCurrency: "EUR",
    baseRevenueM: 120,
    ownershipPct: 95,
  },
  // Nimbus
  {
    id: "ENT_NIMBUS_N",
    label: "Nimbus IT Nord",
    project: "PRJ_NIMBUS",
    group: "CG_BUYOUTS",
    industry: "BrandedFood",
    geography: "Italy",
    localCurrency: "EUR",
    baseRevenueM: 210,
    ownershipPct: 100,
  },
  {
    id: "ENT_NIMBUS_S",
    label: "Nimbus IT Sud",
    project: "PRJ_NIMBUS",
    group: "CG_BUYOUTS",
    industry: "BrandedFood",
    geography: "Italy",
    localCurrency: "EUR",
    baseRevenueM: 145,
    ownershipPct: 100,
  },
  {
    id: "ENT_NIMBUS_BRANDS",
    label: "Nimbus Brands",
    project: "PRJ_NIMBUS",
    group: "CG_BUYOUTS",
    industry: "BrandedFood",
    geography: "Italy",
    localCurrency: "EUR",
    baseRevenueM: 68,
    ownershipPct: 100,
  },
  // Solstice
  {
    id: "ENT_SOLSTICE_DE",
    label: "Solstice DE",
    project: "PRJ_SOLSTICE",
    group: "CG_GROWTH",
    industry: "Fintech",
    geography: "DACH",
    localCurrency: "EUR",
    baseRevenueM: 46,
    ownershipPct: 34,
  },
  {
    id: "ENT_SOLSTICE_UK",
    label: "Solstice UK",
    project: "PRJ_SOLSTICE",
    group: "CG_GROWTH",
    industry: "Fintech",
    geography: "UK_I",
    localCurrency: "GBP",
    baseRevenueM: 22,
    ownershipPct: 34,
  },
  // Lumen
  {
    id: "ENT_LUMEN_DE",
    label: "Lumen DE",
    project: "PRJ_LUMEN",
    group: "CG_GROWTH",
    industry: "DigitalHealth",
    geography: "DACH",
    localCurrency: "EUR",
    baseRevenueM: 28,
    ownershipPct: 41,
  },
  {
    id: "ENT_LUMEN_FR",
    label: "Lumen FR",
    project: "PRJ_LUMEN",
    group: "CG_GROWTH",
    industry: "DigitalHealth",
    geography: "France",
    localCurrency: "EUR",
    baseRevenueM: 19,
    ownershipPct: 41,
  },
  {
    id: "ENT_LUMEN_ES",
    label: "Lumen ES",
    project: "PRJ_LUMEN",
    group: "CG_GROWTH",
    industry: "DigitalHealth",
    geography: "Iberia",
    localCurrency: "EUR",
    baseRevenueM: 11,
    ownershipPct: 41,
  },
  // Kadenza
  {
    id: "ENT_KADENZA_PL",
    label: "Kadenza PL",
    project: "PRJ_KADENZA",
    group: "CG_GROWTH",
    industry: "Media",
    geography: "CEE",
    localCurrency: "PLN",
    baseRevenueM: 54,
    ownershipPct: 47,
  },
  {
    id: "ENT_KADENZA_CZ",
    label: "Kadenza CZ",
    project: "PRJ_KADENZA",
    group: "CG_GROWTH",
    industry: "Media",
    geography: "CEE",
    localCurrency: "PLN",
    baseRevenueM: 28,
    ownershipPct: 47,
  },
  // Praxis
  {
    id: "ENT_PRAXIS_DACH",
    label: "Praxis DACH",
    project: "PRJ_PRAXIS",
    group: "CG_GROWTH",
    industry: "ProfServices",
    geography: "DACH",
    localCurrency: "EUR",
    baseRevenueM: 62,
    ownershipPct: 38,
  },
  {
    id: "ENT_PRAXIS_NORDIC",
    label: "Praxis Nordic",
    project: "PRJ_PRAXIS",
    group: "CG_GROWTH",
    industry: "ProfServices",
    geography: "Nordics",
    localCurrency: "SEK",
    baseRevenueM: 34,
    ownershipPct: 38,
  },
  // Argon
  {
    id: "ENT_ARGON_IT",
    label: "Argon IT",
    project: "PRJ_ARGON",
    group: "CG_SPECSIT",
    industry: "Retail",
    geography: "Italy",
    localCurrency: "EUR",
    baseRevenueM: 195,
    ownershipPct: 76,
  },
  {
    id: "ENT_ARGON_ES",
    label: "Argon ES",
    project: "PRJ_ARGON",
    group: "CG_SPECSIT",
    industry: "Retail",
    geography: "Iberia",
    localCurrency: "EUR",
    baseRevenueM: 88,
    ownershipPct: 76,
  },
  // Beacon
  {
    id: "ENT_BEACON_DE",
    label: "Beacon DE",
    project: "PRJ_BEACON",
    group: "CG_SPECSIT",
    industry: "EnergyTransition",
    geography: "DACH",
    localCurrency: "EUR",
    baseRevenueM: 72,
    ownershipPct: 54,
  },
  {
    id: "ENT_BEACON_PL",
    label: "Beacon PL",
    project: "PRJ_BEACON",
    group: "CG_SPECSIT",
    industry: "EnergyTransition",
    geography: "CEE",
    localCurrency: "PLN",
    baseRevenueM: 41,
    ownershipPct: 54,
  },
  // Tribune
  {
    id: "ENT_TRIBUNE_FR",
    label: "Tribune FR",
    project: "PRJ_TRIBUNE",
    group: "CG_SPECSIT",
    industry: "MediaTurnaround",
    geography: "France",
    localCurrency: "EUR",
    baseRevenueM: 118,
    ownershipPct: 65,
  },
  {
    id: "ENT_TRIBUNE_BE",
    label: "Tribune BE",
    project: "PRJ_TRIBUNE",
    group: "CG_SPECSIT",
    industry: "MediaTurnaround",
    geography: "Benelux",
    localCurrency: "EUR",
    baseRevenueM: 46,
    ownershipPct: 65,
  },
];

// Quick lookup helpers
export const ENTITIES_BY_ID = Object.fromEntries(ENTITIES.map((e) => [e.id, e]));
export const PROJECTS_BY_ID = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));
export const GROUPS_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g]));

export const ENTITIES_BY_PROJECT: Record<string, EntityFixture[]> = ENTITIES.reduce(
  (acc, e) => {
    (acc[e.project] ??= []).push(e);
    return acc;
  },
  {} as Record<string, EntityFixture[]>
);

export const PROJECTS_BY_GROUP: Record<string, ProjectFixture[]> = PROJECTS.reduce(
  (acc, p) => {
    (acc[p.group] ??= []).push(p);
    return acc;
  },
  {} as Record<string, ProjectFixture[]>
);
