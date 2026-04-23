import { NextResponse } from "next/server";
import { resolve } from "@/lib/jedox/engine";
import {
  ACCOUNT_DERIVED,
  ACCOUNT_LEAVES,
  VERSIONS,
  type VersionId,
} from "@/lib/jedox/schema";
import { DEMO_CURRENT_PERIOD, monthIndexToPeriod } from "@/lib/jedox/time";
import { labelFor } from "@/lib/jedox/catalog";

export const runtime = "nodejs";

interface LineSpec {
  id: string;
  label: string;
  indent?: number;
  bold?: boolean;
  isPct?: boolean;
  kind: "leaf" | "derived" | "subtotal";
}

const PL_LINES: LineSpec[] = [
  { id: ACCOUNT_LEAVES.Revenue_Product, label: "Revenue — Product", indent: 1, kind: "leaf" },
  { id: ACCOUNT_LEAVES.Revenue_Services, label: "Revenue — Services", indent: 1, kind: "leaf" },
  { id: ACCOUNT_DERIVED.Revenue, label: "Revenue", bold: true, kind: "derived" },
  { id: ACCOUNT_LEAVES.COGS_Material, label: "COGS — Material", indent: 1, kind: "leaf" },
  { id: ACCOUNT_LEAVES.COGS_Labor, label: "COGS — Labor", indent: 1, kind: "leaf" },
  { id: ACCOUNT_DERIVED.COGS, label: "COGS", kind: "derived" },
  { id: ACCOUNT_DERIVED.GrossProfit, label: "Gross Profit", bold: true, kind: "derived" },
  { id: ACCOUNT_DERIVED.GrossMarginPct, label: "Gross Margin %", isPct: true, kind: "derived" },
  { id: ACCOUNT_LEAVES.OpEx_SG_A, label: "SG&A", indent: 1, kind: "leaf" },
  { id: ACCOUNT_LEAVES.OpEx_R_D, label: "R&D", indent: 1, kind: "leaf" },
  { id: ACCOUNT_LEAVES.OpEx_Marketing, label: "Marketing", indent: 1, kind: "leaf" },
  { id: ACCOUNT_DERIVED.OpEx, label: "Operating Expenses", kind: "derived" },
  { id: ACCOUNT_DERIVED.EBITDA, label: "EBITDA", bold: true, kind: "derived" },
  {
    id: ACCOUNT_DERIVED.EBITDAMarginPct,
    label: "EBITDA Margin %",
    isPct: true,
    kind: "derived",
  },
  { id: ACCOUNT_LEAVES.DA, label: "D&A", kind: "leaf" },
  { id: ACCOUNT_DERIVED.EBIT, label: "EBIT", bold: true, kind: "derived" },
  { id: ACCOUNT_LEAVES.Interest, label: "Interest", kind: "leaf" },
  { id: ACCOUNT_LEAVES.Tax, label: "Tax", kind: "leaf" },
  { id: ACCOUNT_DERIVED.NetIncome, label: "Net Income", bold: true, kind: "derived" },
];

const BS_LINES: LineSpec[] = [
  { id: ACCOUNT_LEAVES.Cash, label: "Cash", indent: 1, kind: "leaf" },
  { id: ACCOUNT_LEAVES.Receivables, label: "Receivables", indent: 1, kind: "leaf" },
  { id: ACCOUNT_LEAVES.Inventory, label: "Inventory", indent: 1, kind: "leaf" },
  { id: ACCOUNT_LEAVES.PPE, label: "PP&E", indent: 1, kind: "leaf" },
  { id: ACCOUNT_LEAVES.Goodwill, label: "Goodwill", indent: 1, kind: "leaf" },
  { id: ACCOUNT_DERIVED.TotalAssets, label: "Total Assets", bold: true, kind: "derived" },
  { id: ACCOUNT_LEAVES.Payables, label: "Payables", indent: 1, kind: "leaf" },
  { id: ACCOUNT_LEAVES.ShortTermDebt, label: "Short-term Debt", indent: 1, kind: "leaf" },
  { id: ACCOUNT_LEAVES.LongTermDebt, label: "Long-term Debt", indent: 1, kind: "leaf" },
  { id: ACCOUNT_DERIVED.TotalDebt, label: "Total Debt", kind: "derived" },
  { id: ACCOUNT_DERIVED.NetDebt, label: "Net Debt", bold: true, kind: "derived" },
  { id: ACCOUNT_DERIVED.WorkingCapital, label: "Working Capital", kind: "derived" },
  { id: ACCOUNT_LEAVES.Equity, label: "Equity", bold: true, kind: "leaf" },
];

const CF_LINES: LineSpec[] = [
  { id: ACCOUNT_LEAVES.CF_Operating, label: "Cash from Operations", kind: "leaf", bold: true },
  { id: ACCOUNT_LEAVES.CF_Investing, label: "Cash from Investing", kind: "leaf" },
  { id: ACCOUNT_LEAVES.CapEx, label: "(of which) CapEx", indent: 1, kind: "leaf" },
  { id: ACCOUNT_LEAVES.CF_Financing, label: "Cash from Financing", kind: "leaf" },
  { id: ACCOUNT_DERIVED.FCF, label: "Free Cash Flow", bold: true, kind: "derived" },
];

const KPI_LINES: LineSpec[] = [
  { id: ACCOUNT_LEAVES.Headcount, label: "Headcount (FTE)", kind: "leaf" },
  { id: ACCOUNT_LEAVES.Orders, label: "Orders", kind: "leaf" },
  { id: ACCOUNT_LEAVES.ASP, label: "ASP", kind: "leaf" },
  { id: ACCOUNT_LEAVES.ARR, label: "ARR (annualized)", kind: "leaf" },
];

const STATEMENTS: Record<"PL" | "BS" | "CF" | "KPI", LineSpec[]> = {
  PL: PL_LINES,
  BS: BS_LINES,
  CF: CF_LINES,
  KPI: KPI_LINES,
};

interface RowOut {
  id: string;
  label: string;
  indent?: number;
  bold?: boolean;
  isPct?: boolean;
  isBS?: boolean;
  kind: "leaf" | "derived" | "subtotal";
  ytdActual: number | null;
  ytdBudget: number | null;
  ytdPy: number | null;
  ytdMgmtFcst?: number | null;
  ytdPilFcst?: number | null;
  deltaBudget: number | null;
  deltaPctBudget: number | null;
  deltaYoY: number | null;
  deltaPctYoY: number | null;
}

function getValue(entity: string, account: string, period: string, version: VersionId) {
  const r = resolve({ entity, account, period, version, currency: "EUR" });
  return r?.value ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ytd = `YTD-${DEMO_CURRENT_PERIOD}`;
  const ytdPy = `YTD-2025-03`;
  const current = DEMO_CURRENT_PERIOD;
  const priorPeriod = monthIndexToPeriod(35 - 12);

  const result: Record<string, RowOut[]> = {};
  for (const [stmt, lines] of Object.entries(STATEMENTS)) {
    const isBS = stmt === "BS";
    const rows: RowOut[] = [];
    for (const l of lines) {
      const period = isBS ? current : ytd;
      const pyPeriod = isBS ? priorPeriod : ytdPy;
      const actual = getValue(id, l.id, period, VERSIONS.Actual);
      const budget = getValue(id, l.id, period, VERSIONS.Budget2026);
      const py = getValue(id, l.id, pyPeriod, VERSIONS.Actual);
      const mgmt = stmt === "PL" ? getValue(id, l.id, ytd, VERSIONS.MgmtForecastYTG) : null;
      const pil = stmt === "PL" ? getValue(id, l.id, ytd, VERSIONS.PILForecastYTG) : null;

      const deltaBudget = actual !== null && budget !== null ? actual - budget : null;
      const deltaPctBudget =
        deltaBudget !== null && budget !== null && budget !== 0
          ? deltaBudget / Math.abs(budget)
          : null;
      const deltaYoY = actual !== null && py !== null ? actual - py : null;
      const deltaPctYoY =
        deltaYoY !== null && py !== null && py !== 0 ? deltaYoY / Math.abs(py) : null;

      rows.push({
        id: l.id,
        label: l.label,
        indent: l.indent,
        bold: l.bold,
        isPct: l.isPct,
        isBS,
        kind: l.kind,
        ytdActual: actual,
        ytdBudget: budget,
        ytdPy: py,
        ytdMgmtFcst: mgmt,
        ytdPilFcst: pil,
        deltaBudget,
        deltaPctBudget,
        deltaYoY,
        deltaPctYoY,
      });
    }
    result[stmt] = rows;
  }

  return NextResponse.json({
    entity: id,
    label: labelFor(id),
    asOfPeriod: DEMO_CURRENT_PERIOD,
    ytdPeriod: ytd,
    ytdPyPeriod: ytdPy,
    statements: result,
  });
}
