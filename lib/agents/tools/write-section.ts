import { z } from "zod";
import type { ToolDef } from "./types";
import { emitEvent } from "../runtime";
import { resolve } from "@/lib/jedox/engine";
import type { VersionId } from "@/lib/jedox/schema";

// Structured citation. The body references entries via `[cite:N]` markers
// where N matches `citations[].id`. The UI renders a clickable chip for each
// marker and opens the cell inspector on click.
const CitationSchema = z.object({
  id: z
    .number()
    .int()
    .min(1)
    .describe("Sequential 1-based id matching the `[cite:N]` marker in the body."),
  entity: z.string().describe("Entity id (e.g. ENT_FORTUNA_DE, PORTFOLIO_TOTAL)."),
  account: z
    .string()
    .describe(
      "Account id (e.g. Revenue, EBITDA, EBITDAMarginPct, NetDebt, FairValue, Bridge:ebitdaEffect)."
    ),
  period: z.string().describe("Period id (e.g. YTD-2026-03, 2026-03, 2025-12)."),
  version: z
    .string()
    .describe(
      "Version id (Actual, Budget-2026, Budget-2025, MgmtForecast-YTG, PIL-Forecast-YTG, Valuation-V1, Valuation-V2)."
    ),
  value: z
    .number()
    .describe(
      "The numeric value you read from the cube for this cell. Server-validated within 1% of the actual cube value — mismatches trigger a warning you must correct."
    ),
});

const InputSchema = z.object({
  id: z
    .string()
    .describe(
      "Stable kebab-case id. Financial Performance: exec-summary, pl-performance, balance-sheet-cashflow, forward-view. Fair Valuation: exec-summary, fv-bridge, underlying-performance."
    ),
  title: z.string().describe("Human-readable section heading."),
  body: z
    .string()
    .describe(
      "Markdown body. Reference citations with `[cite:N]` markers (where N matches a `citations[].id`). Every numeric claim must carry an inline [cite:N]. Three-element rule: every sentence contains line item + magnitude + comparison base."
    ),
  citations: z
    .array(CitationSchema)
    .describe(
      "Structured citations matched by id to `[cite:N]` markers in the body. Each cite is validated server-side against the cube; value must match within 1%. Re-use N within the body for the same cell."
    ),
  order: z.number().int().optional().describe("Display order (lower = earlier)."),
});

export type WriteSectionInput = z.infer<typeof InputSchema>;

interface CitationWarning {
  kind: "unresolvable" | "value_mismatch" | "unreferenced" | "dangling_marker";
  id?: number;
  marker?: string;
  entity?: string;
  account?: string;
  period?: string;
  version?: string;
  citedValue?: number;
  actualValue?: number;
  ratio?: number;
  message: string;
}

interface CitationAudit {
  total: number;
  resolved: number;
  warnings: CitationWarning[];
}

// Marker regex: [cite:1], [cite:42], etc.
const MARKER_RE = /\[cite:(\d+)\]/g;

const VALUE_TOLERANCE_PCT = 0.01;
const VALUE_TOLERANCE_MIN_ABS = 1;

function auditCitations(input: WriteSectionInput): CitationAudit {
  const warnings: CitationWarning[] = [];
  let resolved = 0;

  // Build id → citation map for fast lookup.
  const byId = new Map<number, WriteSectionInput["citations"][number]>();
  for (const c of input.citations) byId.set(c.id, c);

  // Validate each citation against the cube.
  for (const c of input.citations) {
    const r = resolve({
      entity: c.entity,
      account: c.account,
      period: c.period,
      version: c.version as VersionId,
      currency: "EUR",
    });
    // `resolve()` returns null for a bad (entity × account × period × version)
    // tuple, and may also return an object with `value === undefined` for
    // period-aggregation paths that hit nonexistent leaves. Both count as
    // unresolvable for citation validation purposes.
    if (!r || r.value === undefined || !Number.isFinite(r.value)) {
      warnings.push({
        kind: "unresolvable",
        id: c.id,
        entity: c.entity,
        account: c.account,
        period: c.period,
        version: c.version,
        citedValue: c.value,
        message: `Citation [${c.id}] — cube has no cell for ${c.entity}.${c.account}@${c.period}/${c.version}. Verify the tuple via query_cube and correct or remove the citation.`,
      });
      continue;
    }
    const actual = r.value;
    const absTolerance = Math.max(Math.abs(actual) * VALUE_TOLERANCE_PCT, VALUE_TOLERANCE_MIN_ABS);
    const diff = Math.abs(c.value - actual);
    if (diff > absTolerance) {
      warnings.push({
        kind: "value_mismatch",
        id: c.id,
        entity: c.entity,
        account: c.account,
        period: c.period,
        version: c.version,
        citedValue: c.value,
        actualValue: actual,
        ratio: actual !== 0 ? c.value / actual : Number.NaN,
        message: `Citation [${c.id}] — cited ${c.value} but cube value is ${actual} for ${c.entity}.${c.account}@${c.period}/${c.version}. Re-query and correct the cited value.`,
      });
      continue;
    }
    resolved++;
  }

  // Cross-check: every marker in body must point to a known id; every cite
  // should be referenced at least once.
  const referenced = new Set<number>();
  const re = new RegExp(MARKER_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(input.body))) {
    const n = Number(m[1]);
    referenced.add(n);
    if (!byId.has(n)) {
      warnings.push({
        kind: "dangling_marker",
        marker: m[0],
        id: n,
        message: `Marker [cite:${n}] appears in the body but has no entry in citations[]. Add a citation with id=${n} or remove the marker.`,
      });
    }
  }
  for (const c of input.citations) {
    if (!referenced.has(c.id)) {
      warnings.push({
        kind: "unreferenced",
        id: c.id,
        message: `citations[${c.id}] is declared but no [cite:${c.id}] marker in body. Add the marker or drop the citation.`,
      });
    }
  }

  return { total: input.citations.length, resolved, warnings };
}

export const writeSectionTool: ToolDef<
  WriteSectionInput,
  {
    ack: true;
    sectionId: string;
    citations: CitationAudit;
    citationsOk: boolean;
  }
> = {
  name: "write_section",
  description:
    "Stream a finalized analytical section into the document preview. Use once per section (exec-summary, pl-performance, balance-sheet-cashflow, forward-view, fv-bridge, underlying-performance). Every numeric claim must carry an inline [cite:N] marker paired with a matching entry in the citations[] array. The tool re-resolves each citation against the cube; mismatches beyond 1% or dangling markers come back as warnings — correct them with a follow-up write_section for the same id.",
  input_schema: InputSchema,
  label: (input) => `write_section(${input.id})`,
  async execute(input, ctx) {
    const audit = auditCitations(input);
    emitEvent(ctx.runId, {
      type: "section_ready",
      runId: ctx.runId,
      section: {
        id: input.id,
        title: input.title,
        body: input.body,
        citations: input.citations,
        order: input.order ?? 0,
      },
    });
    const citationsOk = audit.total > 0 && audit.warnings.length === 0;
    const summary =
      audit.total === 0
        ? `wrote "${input.title}" · no citations provided (add [cite:N] markers + citations[] for every number)`
        : audit.warnings.length === 0
        ? `wrote "${input.title}" · ${audit.resolved}/${audit.total} citations verified ✓`
        : `wrote "${input.title}" · ${audit.resolved}/${audit.total} verified, ${audit.warnings.length} need correction`;
    return {
      output: { ack: true, sectionId: input.id, citations: audit, citationsOk },
      summary,
    };
  },
};
