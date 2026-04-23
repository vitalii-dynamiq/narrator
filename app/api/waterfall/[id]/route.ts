import { NextResponse } from "next/server";
import { resolve } from "@/lib/jedox/engine";
import { ACCOUNT_DERIVED, VERSIONS } from "@/lib/jedox/schema";
import { DEMO_CURRENT_PERIOD } from "@/lib/jedox/time";
import { labelFor } from "@/lib/jedox/catalog";

export const runtime = "nodejs";

interface Bar {
  id: string;
  label: string;
  value: number;
  cumulative: number;
  kind: "anchor" | "contribution";
  direction: "up" | "down" | "neutral";
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ytd = `YTD-${DEMO_CURRENT_PERIOD}`;

  // Get Budget and Actual for the aggregates that drive EBITDA
  const pullBA = (account: string) => {
    const actual =
      resolve({ entity: id, account, period: ytd, version: VERSIONS.Actual, currency: "EUR" })?.value ?? 0;
    const budget =
      resolve({ entity: id, account, period: ytd, version: VERSIONS.Budget2026, currency: "EUR" })?.value ?? 0;
    return { actual, budget, delta: actual - budget };
  };

  const rev = pullBA(ACCOUNT_DERIVED.Revenue);
  const cogs = pullBA(ACCOUNT_DERIVED.COGS);
  const opex = pullBA(ACCOUNT_DERIVED.OpEx);
  const ebitda = pullBA(ACCOUNT_DERIVED.EBITDA);

  // EBITDA identity: EBITDA = Revenue - COGS - OpEx
  // Δ EBITDA = Δ Revenue - Δ COGS - Δ OpEx
  const revContrib = rev.delta;
  const cogsContrib = -cogs.delta; // if actual COGS higher, hurts EBITDA
  const opexContrib = -opex.delta;
  const totalContrib = revContrib + cogsContrib + opexContrib;
  const residual = ebitda.delta - totalContrib; // one-offs etc.

  let cumulative = ebitda.budget;
  const bars: Bar[] = [
    {
      id: "start",
      label: "Budget EBITDA",
      value: ebitda.budget,
      cumulative: ebitda.budget,
      kind: "anchor",
      direction: "neutral",
    },
  ];
  const push = (label: string, delta: number, idKey: string) => {
    cumulative += delta;
    bars.push({
      id: idKey,
      label,
      value: delta,
      cumulative,
      kind: "contribution",
      direction: delta > 0 ? "up" : delta < 0 ? "down" : "neutral",
    });
  };
  push("Revenue Δ", revContrib, "rev");
  push("COGS Δ", cogsContrib, "cogs");
  push("OpEx Δ", opexContrib, "opex");
  if (Math.abs(residual) > 1) push("Other / one-offs", residual, "other");
  bars.push({
    id: "end",
    label: "Actual EBITDA",
    value: ebitda.actual,
    cumulative: ebitda.actual,
    kind: "anchor",
    direction: "neutral",
  });

  return NextResponse.json({
    entity: id,
    label: labelFor(id),
    startValue: ebitda.budget,
    endValue: ebitda.actual,
    bars,
    metric: "EBITDA",
  });
}
