import { describe, it, expect, vi } from "vitest";
import { writeSectionTool, type WriteSectionInput } from "@/lib/agents/tools/write-section";
import { resolve } from "@/lib/jedox/engine";

function fakeCtx() {
  const events: unknown[] = [];
  return {
    ctx: {
      runId: "r1",
      parentNodeId: "n1",
      recordCellRefs: () => undefined,
    },
    events,
  };
}

// emitEvent is imported inside write-section, but it just pushes to the run
// buffer; if no run is registered the event is silently dropped. That's fine
// for unit tests — we only care about the tool's return value.

describe("write_section · auditCitations", () => {
  it("flags all citations verified when values match the cube within 1%", async () => {
    const rev = resolve({
      entity: "ENT_FORTUNA_DE",
      account: "Revenue",
      period: "YTD-2026-03",
      version: "Actual",
      currency: "EUR",
    })!.value;
    const ebitda = resolve({
      entity: "ENT_FORTUNA_DE",
      account: "EBITDA",
      period: "YTD-2026-03",
      version: "Actual",
      currency: "EUR",
    })!.value;
    const input: WriteSectionInput = {
      id: "exec-summary",
      title: "Exec",
      body: "Revenue €X [cite:1]; EBITDA €Y [cite:2].",
      citations: [
        {
          id: 1,
          entity: "ENT_FORTUNA_DE",
          account: "Revenue",
          period: "YTD-2026-03",
          version: "Actual",
          value: rev,
        },
        {
          id: 2,
          entity: "ENT_FORTUNA_DE",
          account: "EBITDA",
          period: "YTD-2026-03",
          version: "Actual",
          value: ebitda,
        },
      ],
      order: 0,
    };
    const { ctx } = fakeCtx();
    const r = await writeSectionTool.execute(input, ctx);
    expect(r.output.citationsOk).toBe(true);
    expect(r.output.citations.warnings).toHaveLength(0);
    expect(r.output.citations.resolved).toBe(2);
  });

  it("flags a citation that can't be validated (bogus entity with non-zero value)", async () => {
    const input: WriteSectionInput = {
      id: "exec-summary",
      title: "Exec",
      body: "Nope [cite:1].",
      citations: [
        {
          id: 1,
          entity: "ENT_NOT_A_THING",
          account: "Revenue",
          period: "YTD-2026-03",
          version: "Actual",
          value: 1000,
        },
      ],
      order: 0,
    };
    const { ctx } = fakeCtx();
    const r = await writeSectionTool.execute(input, ctx);
    expect(r.output.citationsOk).toBe(false);
    // Resolver returns 0 for an unknown entity (rather than null), so the
    // audit flags a value_mismatch — either way the citation is unverified.
    expect(["unresolvable", "value_mismatch"]).toContain(
      r.output.citations.warnings[0].kind
    );
  });

  it("flags a value mismatch when cited value is wildly off", async () => {
    const input: WriteSectionInput = {
      id: "exec-summary",
      title: "Exec",
      body: "Revenue €wrong [cite:1].",
      citations: [
        {
          id: 1,
          entity: "ENT_FORTUNA_DE",
          account: "Revenue",
          period: "YTD-2026-03",
          version: "Actual",
          value: 1, // nowhere near the real value
        },
      ],
      order: 0,
    };
    const { ctx } = fakeCtx();
    const r = await writeSectionTool.execute(input, ctx);
    expect(r.output.citationsOk).toBe(false);
    expect(r.output.citations.warnings[0].kind).toBe("value_mismatch");
  });

  it("flags a dangling [cite:N] marker with no matching citation", async () => {
    const input: WriteSectionInput = {
      id: "exec-summary",
      title: "Exec",
      body: "Dangling [cite:99].",
      citations: [],
      order: 0,
    };
    const { ctx } = fakeCtx();
    const r = await writeSectionTool.execute(input, ctx);
    expect(r.output.citations.warnings.some((w) => w.kind === "dangling_marker")).toBe(true);
  });

  it("flags an unreferenced citation present in citations[] but not in body", async () => {
    const rev = resolve({
      entity: "ENT_FORTUNA_DE",
      account: "Revenue",
      period: "YTD-2026-03",
      version: "Actual",
      currency: "EUR",
    })!.value;
    const input: WriteSectionInput = {
      id: "exec-summary",
      title: "Exec",
      body: "Text with no citation marker.",
      citations: [
        {
          id: 1,
          entity: "ENT_FORTUNA_DE",
          account: "Revenue",
          period: "YTD-2026-03",
          version: "Actual",
          value: rev,
        },
      ],
      order: 0,
    };
    const { ctx } = fakeCtx();
    const r = await writeSectionTool.execute(input, ctx);
    expect(r.output.citations.warnings.some((w) => w.kind === "unreferenced")).toBe(true);
  });
});
