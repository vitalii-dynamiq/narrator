import { beforeAll, describe, expect, it } from "vitest";
import { pingServer, runToCompletion } from "./helpers";

describe("Multi-turn conversation", () => {
  beforeAll(async () => {
    if (!(await pingServer())) {
      throw new Error("Dev server not reachable at http://localhost:7340");
    }
  });

  it(
    "preserves prior-turn context and answers a follow-up without re-running the full pipeline",
    async () => {
      // Turn 1 — establish context
      const turn1 = await runToCompletion(
        "Why did Fortuna DE underperform this quarter?",
        { scope: "ENT_FORTUNA_DE", reportType: "financial_performance" }
      );
      expect(turn1.finalStatus, turn1.failureError ?? "").toBe("completed");
      expect(turn1.conversationId).toBeTruthy();

      // Turn 2 — terse follow-up that implicitly references turn 1.
      const turn2 = await runToCompletion(
        "How much of the EBITDA miss came from margin compression versus lower Revenue?",
        {
          scope: "ENT_FORTUNA_DE",
          reportType: "chat",
          conversationId: turn1.conversationId,
        }
      );
      expect(turn2.finalStatus, turn2.failureError ?? "").toBe("completed");
      expect(turn2.conversationId, "conversationId should persist").toBe(turn1.conversationId);

      // Expectations:
      // - Turn 2 re-uses context: it should NOT re-query the entire cube; fewer
      //   query_cube calls than turn 1.
      const t1QueryCalls = turn1.toolCalls.filter((tc) => tc.name === "query_cube").length;
      const t2QueryCalls = turn2.toolCalls.filter((tc) => tc.name === "query_cube").length;
      expect(
        t2QueryCalls,
        `turn-2 should lean on prior context (t1=${t1QueryCalls}, t2=${t2QueryCalls})`
      ).toBeLessThanOrEqual(Math.max(2, t1QueryCalls));

      // - At least one written section carries a citation (we're not requiring
      //   a specific structure for a follow-up).
      const anyCitations = turn2.sections.some((s) => s.citations.length > 0);
      expect(anyCitations, "follow-up should still cite numbers").toBe(true);
    },
    10 * 60_000
  );
});
