import { beforeAll, describe, expect, it } from "vitest";
import { assertCitationResolves, pingServer, runToCompletion } from "./helpers";

describe("Fair Valuation — Atlas NL", () => {
  beforeAll(async () => {
    if (!(await pingServer())) {
      throw new Error("Dev server not reachable at http://localhost:7340");
    }
  });

  it(
    "produces 3 sections with Bridge:* legs and V1/V2 FairValue citations",
    async () => {
      const run = await runToCompletion(
        "Walk me through the Atlas NL fair value bridge leg by leg.",
        { scope: "ENT_ATLAS_NL", reportType: "fair_valuation" }
      );

      expect(run.finalStatus, run.failureError ?? "").toBe("completed");

      const ids = run.sections.map((s) => s.id).sort();
      expect(ids).toEqual(["exec-summary", "fv-bridge", "underlying-performance"]);

      const allCites = run.sections.flatMap((s) => s.citations);
      expect(allCites.length).toBeGreaterThanOrEqual(15);

      // Every citation resolves
      for (const c of allCites) {
        const { ok, serverValue } = await assertCitationResolves(c);
        expect(
          ok,
          `citation ${c.entity}.${c.account}@${c.period}/${c.version} cited ${c.value} vs cube ${serverValue}`
        ).toBe(true);
      }

      // Bridge:* legs should appear
      const bridgeLegs = allCites.filter((c) => c.account.startsWith("Bridge:"));
      expect(bridgeLegs.length, "at least 2 Bridge:* citations expected").toBeGreaterThanOrEqual(2);

      // FairValue at V1 and V2
      const fvV1 = allCites.find(
        (c) => c.account === "FairValue" && c.version === "Valuation-V1"
      );
      const fvV2 = allCites.find(
        (c) => c.account === "FairValue" && c.version === "Valuation-V2"
      );
      expect(fvV1, "missing FairValue@V1").toBeTruthy();
      expect(fvV2, "missing FairValue@V2").toBeTruthy();

      // memory tool at least once
      expect(
        run.toolCalls.filter((tc) => tc.name === "memory").length
      ).toBeGreaterThanOrEqual(1);
    },
    5 * 60_000
  );
});
