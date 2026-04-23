import { NextResponse } from "next/server";
import { resolve } from "@/lib/jedox/engine";
import type { VersionId } from "@/lib/jedox/schema";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== "FIN_CUBE") {
    return NextResponse.json({ error: "Only FIN_CUBE slice via this endpoint" }, { status: 400 });
  }

  const url = new URL(req.url);
  const entity = url.searchParams.get("entity");
  const accountsParam = url.searchParams.get("accounts");
  const periodsParam = url.searchParams.get("periods");
  const versionsParam = url.searchParams.get("versions");
  const currency = (url.searchParams.get("currency") ?? "EUR") as "EUR";

  if (!entity || !accountsParam || !periodsParam || !versionsParam) {
    return NextResponse.json(
      { error: "Required: entity, accounts, periods, versions" },
      { status: 400 }
    );
  }

  const accounts = accountsParam.split(",");
  const periods = periodsParam.split(",");
  const versions = versionsParam.split(",") as VersionId[];

  const cells: Array<{
    entity: string;
    account: string;
    period: string;
    version: string;
    value: number;
    currency: string;
    derived: boolean;
    rule?: string;
    provenance: number;
  }> = [];

  for (const account of accounts) {
    for (const period of periods) {
      for (const version of versions) {
        const r = resolve({ entity, account, period, version, currency });
        if (!r) continue;
        cells.push({
          entity,
          account,
          period,
          version,
          value: r.value,
          currency: r.currency,
          derived: r.derived,
          rule: r.rule,
          provenance: r.provenance.length,
        });
      }
    }
  }

  return NextResponse.json({
    shape: { rows: accounts.length, cols: periods.length * versions.length },
    cells,
  });
}
