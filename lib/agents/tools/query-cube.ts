import { z } from "zod";
import type { ToolDef } from "./types";
import { resolve } from "@/lib/jedox/engine";
import type { VersionId, CellRef } from "@/lib/jedox/schema";
import { encodeCellRef } from "@/lib/jedox/engine";

const InputSchema = z.object({
  entity: z.string().describe("Entity id (e.g. ENT_FORTUNA_DE, PRJ_FORTUNA, CG_BUYOUTS, PORTFOLIO_TOTAL)"),
  accounts: z
    .array(z.string())
    .min(1)
    .max(24)
    .describe(
      "Account ids to query — leaf (e.g. Revenue_Product) or derived (e.g. Revenue, EBITDA, EBITDAMarginPct, NetDebt, FCF). The system prompt lists the full catalog. Max 24 per call — batch wider scans across calls."
    ),
  periods: z
    .array(z.string())
    .min(1)
    .max(24)
    .describe(
      'Period ids. Monthly: "2026-03". Quarterly: "2026-Q1". YTD through March: "YTD-2026-03". Annual aggregate: "2026". Max 24 per call.'
    ),
  versions: z
    .array(z.string())
    .min(1)
    .max(8)
    .describe(
      "Version ids: Actual, Budget-2026, Budget-2025, MgmtForecast-YTG, PIL-Forecast-YTG, Valuation-V1, Valuation-V2, or MgmtForecast-Y1..Y4 / PIL-Forecast-Y1..Y4. Max 8 per call."
    ),
  currency: z
    .enum(["EUR"])
    .optional()
    .default("EUR")
    .describe("Reporting currency. Only EUR is supported; non-EUR entities are auto-translated."),
});

type Input = z.infer<typeof InputSchema>;

const MAX_CELLS_PER_CALL = 240;

interface Cell {
  entity: string;
  account: string;
  period: string;
  version: string;
  value: number | null;
  derived: boolean;
  rule?: string;
  coord: string; // base64url-encoded CellRef for citation
  provenance: number; // number of leaf cells aggregated
}

interface Output {
  cells: Cell[];
  cellsRead: number;
  truncated?: { requestedCells: number; returnedCells: number; advice: string };
}

export const queryCubeTool: ToolDef<Input, Output> = {
  name: "query_cube",
  description:
    "Query the UNITY financial cube. Returns values for any (entity × account × period × version) combination, with cell coordinates for citation. Handles entity aggregation, period aggregation (YTD/Q/Y), and derivation rules (EBITDA, Revenue, NetDebt, FCF…) automatically. Single-call budget: max 240 cells (accounts × periods × versions). Prefer multiple narrow calls over one wide one.",
  input_schema: InputSchema,
  label: (input) =>
    `query_cube(${input.entity}, ${input.accounts.length}×${input.periods.length}×${input.versions.length})`,
  async execute(input, ctx) {
    const requestedCells = input.accounts.length * input.periods.length * input.versions.length;
    const currency = input.currency ?? "EUR";

    if (requestedCells > MAX_CELLS_PER_CALL) {
      return {
        output: {
          cells: [],
          cellsRead: 0,
          truncated: {
            requestedCells,
            returnedCells: 0,
            advice: `Too many cells requested (${requestedCells} > ${MAX_CELLS_PER_CALL}). Narrow the query: fewer accounts, fewer periods, or fewer versions. Typical calls are 3–8 accounts × 2–4 periods × 1–3 versions. You can split wide scans across multiple calls.`,
          },
        } as Output,
        summary: `refused — ${requestedCells} cells exceeds ${MAX_CELLS_PER_CALL} cap`,
      };
    }

    const cells: Cell[] = [];
    const allRefs: CellRef[] = [];
    let nullCount = 0;
    for (const account of input.accounts) {
      for (const period of input.periods) {
        for (const version of input.versions) {
          const r = resolve({
            entity: input.entity,
            account,
            period,
            version: version as VersionId,
            currency,
          });
          if (!r) {
            cells.push({
              entity: input.entity,
              account,
              period,
              version,
              value: null,
              derived: false,
              coord: "",
              provenance: 0,
            });
            nullCount++;
            continue;
          }
          const leafRef: CellRef = {
            cube: "FIN_CUBE",
            entity: input.entity,
            account,
            time: period,
            version,
            currency,
            measure: "Value",
          };
          allRefs.push(...r.provenance);
          cells.push({
            entity: input.entity,
            account,
            period,
            version,
            value: r.value,
            derived: r.derived,
            rule: r.rule,
            coord: encodeCellRef(leafRef),
            provenance: r.provenance.length,
          });
        }
      }
    }
    ctx.recordCellRefs(allRefs);
    const resolvedCount = cells.length - nullCount;
    const summaryParts = [
      `${resolvedCount}/${cells.length} cells resolved`,
      nullCount > 0 ? `${nullCount} null (check account/period/version ids)` : null,
      `entity ${input.entity}`,
    ].filter(Boolean);
    return {
      output: { cells, cellsRead: allRefs.length },
      cellsRead: allRefs.slice(0, 20),
      summary: summaryParts.join(" · "),
    };
  },
};
