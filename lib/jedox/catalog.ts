// Cube / dimension / rule catalog — used by /api/schema and by the Schema Intelligence agent.

import { ACCOUNT_DERIVED, ACCOUNT_LEAVES, VERSIONS } from "./schema";
import {
  GROUPS,
  PROJECTS,
  ENTITIES,
  GROUPS_BY_ID,
  PROJECTS_BY_ID,
  ENTITIES_BY_ID,
} from "./fixtures/portfolios";

export interface CatalogEntity {
  id: string;
  label: string;
  level: "total" | "group" | "project" | "entity";
  parent?: string;
  industry?: string;
  geography?: string;
  currency?: string;
  baseRevenueM?: number;
  ownershipPct?: number;
}

export function buildEntityCatalog(): CatalogEntity[] {
  const out: CatalogEntity[] = [];
  out.push({ id: "PORTFOLIO_TOTAL", label: "Total Portfolio", level: "total" });
  for (const g of GROUPS) out.push({ id: g.id, label: g.label, level: "group", parent: "PORTFOLIO_TOTAL" });
  for (const p of PROJECTS)
    out.push({ id: p.id, label: p.label, level: "project", parent: p.group });
  for (const e of ENTITIES) {
    out.push({
      id: e.id,
      label: e.label,
      level: "entity",
      parent: e.project,
      industry: e.industry,
      geography: e.geography,
      currency: e.localCurrency,
      baseRevenueM: e.baseRevenueM,
      ownershipPct: e.ownershipPct,
    });
  }
  return out;
}

export function buildAccountCatalog(): {
  leaves: { id: string; group: "PL" | "BS" | "CF" | "KPI" }[];
  derived: { id: string; group: "PL" | "BS" | "CF" | "KPI"; rule: string }[];
} {
  const leaves = [
    { id: ACCOUNT_LEAVES.Revenue_Product, group: "PL" as const },
    { id: ACCOUNT_LEAVES.Revenue_Services, group: "PL" as const },
    { id: ACCOUNT_LEAVES.COGS_Material, group: "PL" as const },
    { id: ACCOUNT_LEAVES.COGS_Labor, group: "PL" as const },
    { id: ACCOUNT_LEAVES.OpEx_SG_A, group: "PL" as const },
    { id: ACCOUNT_LEAVES.OpEx_R_D, group: "PL" as const },
    { id: ACCOUNT_LEAVES.OpEx_Marketing, group: "PL" as const },
    { id: ACCOUNT_LEAVES.DA, group: "PL" as const },
    { id: ACCOUNT_LEAVES.Interest, group: "PL" as const },
    { id: ACCOUNT_LEAVES.Tax, group: "PL" as const },
    { id: ACCOUNT_LEAVES.Cash, group: "BS" as const },
    { id: ACCOUNT_LEAVES.Receivables, group: "BS" as const },
    { id: ACCOUNT_LEAVES.Inventory, group: "BS" as const },
    { id: ACCOUNT_LEAVES.PPE, group: "BS" as const },
    { id: ACCOUNT_LEAVES.Goodwill, group: "BS" as const },
    { id: ACCOUNT_LEAVES.Payables, group: "BS" as const },
    { id: ACCOUNT_LEAVES.ShortTermDebt, group: "BS" as const },
    { id: ACCOUNT_LEAVES.LongTermDebt, group: "BS" as const },
    { id: ACCOUNT_LEAVES.Equity, group: "BS" as const },
    { id: ACCOUNT_LEAVES.CF_Operating, group: "CF" as const },
    { id: ACCOUNT_LEAVES.CF_Investing, group: "CF" as const },
    { id: ACCOUNT_LEAVES.CF_Financing, group: "CF" as const },
    { id: ACCOUNT_LEAVES.CapEx, group: "CF" as const },
    { id: ACCOUNT_LEAVES.Headcount, group: "KPI" as const },
    { id: ACCOUNT_LEAVES.Orders, group: "KPI" as const },
    { id: ACCOUNT_LEAVES.ASP, group: "KPI" as const },
    { id: ACCOUNT_LEAVES.ARR, group: "KPI" as const },
  ];

  const derived = [
    { id: ACCOUNT_DERIVED.Revenue, group: "PL" as const, rule: "[Revenue_Product] + [Revenue_Services]" },
    { id: ACCOUNT_DERIVED.COGS, group: "PL" as const, rule: "[COGS_Material] + [COGS_Labor]" },
    { id: ACCOUNT_DERIVED.GrossProfit, group: "PL" as const, rule: "[Revenue] − [COGS]" },
    { id: ACCOUNT_DERIVED.OpEx, group: "PL" as const, rule: "[OpEx_SG_A] + [OpEx_R_D] + [OpEx_Marketing]" },
    { id: ACCOUNT_DERIVED.EBITDA, group: "PL" as const, rule: "[GrossProfit] − [OpEx]" },
    { id: ACCOUNT_DERIVED.EBIT, group: "PL" as const, rule: "[EBITDA] − [DA]" },
    { id: ACCOUNT_DERIVED.NetIncome, group: "PL" as const, rule: "[EBIT] − [Interest] − [Tax]" },
    {
      id: ACCOUNT_DERIVED.GrossMarginPct,
      group: "PL" as const,
      rule: "[GrossProfit] / [Revenue]",
    },
    {
      id: ACCOUNT_DERIVED.EBITDAMarginPct,
      group: "PL" as const,
      rule: "[EBITDA] / [Revenue]",
    },
    { id: ACCOUNT_DERIVED.TotalDebt, group: "BS" as const, rule: "[ShortTermDebt] + [LongTermDebt]" },
    { id: ACCOUNT_DERIVED.NetDebt, group: "BS" as const, rule: "[TotalDebt] − [Cash]" },
    {
      id: ACCOUNT_DERIVED.TotalAssets,
      group: "BS" as const,
      rule: "[Cash] + [Receivables] + [Inventory] + [PPE] + [Goodwill]",
    },
    {
      id: ACCOUNT_DERIVED.WorkingCapital,
      group: "BS" as const,
      rule: "[Receivables] + [Inventory] − [Payables]",
    },
    { id: ACCOUNT_DERIVED.FCF, group: "CF" as const, rule: "[EBITDA] − [CapEx] − [Tax]" },
  ];

  return { leaves, derived };
}

export const ACCOUNT_LABELS: Record<string, string> = {
  [ACCOUNT_LEAVES.Revenue_Product]: "Revenue — Product",
  [ACCOUNT_LEAVES.Revenue_Services]: "Revenue — Services",
  [ACCOUNT_LEAVES.COGS_Material]: "COGS — Material",
  [ACCOUNT_LEAVES.COGS_Labor]: "COGS — Labor",
  [ACCOUNT_LEAVES.OpEx_SG_A]: "SG&A",
  [ACCOUNT_LEAVES.OpEx_R_D]: "R&D",
  [ACCOUNT_LEAVES.OpEx_Marketing]: "Marketing",
  [ACCOUNT_LEAVES.DA]: "D&A",
  [ACCOUNT_LEAVES.Interest]: "Interest",
  [ACCOUNT_LEAVES.Tax]: "Tax",
  [ACCOUNT_LEAVES.Cash]: "Cash",
  [ACCOUNT_LEAVES.Receivables]: "Receivables",
  [ACCOUNT_LEAVES.Inventory]: "Inventory",
  [ACCOUNT_LEAVES.PPE]: "PP&E",
  [ACCOUNT_LEAVES.Goodwill]: "Goodwill",
  [ACCOUNT_LEAVES.Payables]: "Payables",
  [ACCOUNT_LEAVES.ShortTermDebt]: "Short-term Debt",
  [ACCOUNT_LEAVES.LongTermDebt]: "Long-term Debt",
  [ACCOUNT_LEAVES.Equity]: "Equity",
  [ACCOUNT_LEAVES.CF_Operating]: "Cash from Operations",
  [ACCOUNT_LEAVES.CF_Investing]: "Cash from Investing",
  [ACCOUNT_LEAVES.CF_Financing]: "Cash from Financing",
  [ACCOUNT_LEAVES.CapEx]: "CapEx",
  [ACCOUNT_LEAVES.Headcount]: "Headcount",
  [ACCOUNT_LEAVES.Orders]: "Orders",
  [ACCOUNT_LEAVES.ASP]: "ASP",
  [ACCOUNT_LEAVES.ARR]: "ARR",
  [ACCOUNT_DERIVED.Revenue]: "Revenue",
  [ACCOUNT_DERIVED.COGS]: "COGS",
  [ACCOUNT_DERIVED.GrossProfit]: "Gross Profit",
  [ACCOUNT_DERIVED.OpEx]: "Operating Expenses",
  [ACCOUNT_DERIVED.EBITDA]: "EBITDA",
  [ACCOUNT_DERIVED.EBIT]: "EBIT",
  [ACCOUNT_DERIVED.NetIncome]: "Net Income",
  [ACCOUNT_DERIVED.GrossMarginPct]: "Gross Margin %",
  [ACCOUNT_DERIVED.EBITDAMarginPct]: "EBITDA Margin %",
  [ACCOUNT_DERIVED.TotalDebt]: "Total Debt",
  [ACCOUNT_DERIVED.NetDebt]: "Net Debt",
  [ACCOUNT_DERIVED.TotalAssets]: "Total Assets",
  [ACCOUNT_DERIVED.WorkingCapital]: "Working Capital",
  [ACCOUNT_DERIVED.FCF]: "Free Cash Flow",
};

export const VERSION_LABELS: Record<string, string> = {
  [VERSIONS.Actual]: "Actual",
  [VERSIONS.Budget2025]: "Budget 2025",
  [VERSIONS.Budget2026]: "Budget 2026",
  [VERSIONS.MgmtForecastYTG]: "Forecast (Mgmt) YTG",
  [VERSIONS.PILForecastYTG]: "Forecast (PIL) YTG",
  [VERSIONS.MgmtForecastY1]: "Forecast (Mgmt) Y+1",
  [VERSIONS.MgmtForecastY2]: "Forecast (Mgmt) Y+2",
  [VERSIONS.MgmtForecastY3]: "Forecast (Mgmt) Y+3",
  [VERSIONS.MgmtForecastY4]: "Forecast (Mgmt) Y+4",
  [VERSIONS.PILForecastY1]: "Forecast (PIL) Y+1",
  [VERSIONS.PILForecastY2]: "Forecast (PIL) Y+2",
  [VERSIONS.PILForecastY3]: "Forecast (PIL) Y+3",
  [VERSIONS.PILForecastY4]: "Forecast (PIL) Y+4",
  [VERSIONS.ValuationV1]: "Valuation V1",
  [VERSIONS.ValuationV2]: "Valuation V2",
};

export function labelFor(id: string): string {
  if (ACCOUNT_LABELS[id]) return ACCOUNT_LABELS[id];
  if (VERSION_LABELS[id]) return VERSION_LABELS[id];
  if (GROUPS_BY_ID[id]) return GROUPS_BY_ID[id].label;
  if (PROJECTS_BY_ID[id]) return PROJECTS_BY_ID[id].label;
  if (ENTITIES_BY_ID[id]) return ENTITIES_BY_ID[id].label;
  if (id === "PORTFOLIO_TOTAL") return "Total Portfolio";
  return id;
}
