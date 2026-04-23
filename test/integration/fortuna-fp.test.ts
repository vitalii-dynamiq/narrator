import { beforeAll, describe, expect, it } from "vitest";
import { assertCitationResolves, pingServer, runToCompletion } from "./helpers";

describe("Financial Performance — Fortuna DE", () => {
  beforeAll(async () => {
    if (!(await pingServer())) {
      throw new Error(
        "Dev server not reachable at http://localhost:7340. Run `npm run dev` in another terminal before the integration suite."
      );
    }
  });

  it(
    "runs a full 4-section report with memory recall and verified citations",
    async () => {
      const run = await runToCompletion(
        "Why did Fortuna DE underperform this quarter?",
        { scope: "ENT_FORTUNA_DE", reportType: "financial_performance" }
      );

      // Terminal state
      expect(run.finalStatus, run.failureError ?? "").toBe("completed");

      // Section structure
      expect(run.sections.map((s) => s.id).sort()).toEqual(
        ["balance-sheet-cashflow", "exec-summary", "forward-view", "pl-performance"]
      );

      // Citations density
      for (const s of run.sections) {
        expect(s.citations.length, `section ${s.id} should have ≥3 citations`).toBeGreaterThanOrEqual(3);
      }

      // Every citation resolves cleanly against the cube
      for (const s of run.sections) {
        for (const c of s.citations) {
          const { ok, serverValue } = await assertCitationResolves(c);
          expect(
            ok,
            `citation ${c.entity}.${c.account}@${c.period}/${c.version} cited ${c.value} vs cube ${serverValue}`
          ).toBe(true);
        }
      }

      // Memory tool was invoked at least once
      const memoryCalls = run.toolCalls.filter((tc) => tc.name === "memory");
      expect(memoryCalls.length, "memory tool not called").toBeGreaterThanOrEqual(1);

      // query_cube called at least twice
      const queryCalls = run.toolCalls.filter((tc) => tc.name === "query_cube");
      expect(queryCalls.length, "query_cube should be called at least twice").toBeGreaterThanOrEqual(2);

      // At least one section surfaces memory (📌 From memory) OR the body
      // references the prior linerboard/ASP observation explicitly.
      const anyMemoryCallout = run.sections.some(
        (s) => s.body.includes("📌 From memory") || /linerboard|ASP risk/i.test(s.body)
      );
      expect(anyMemoryCallout, "no memory content surfaced in any section").toBe(true);
    },
    5 * 60_000
  );
});
