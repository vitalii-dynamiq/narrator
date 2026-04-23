import { beforeAll, describe, expect, it } from "vitest";
import { pingServer, runToCompletion } from "./helpers";

describe("code_execution — cross-entity ranking", () => {
  beforeAll(async () => {
    if (!(await pingServer())) {
      throw new Error("Dev server not reachable at http://localhost:7340");
    }
  });

  it(
    "uses the Python sandbox for a top-N ranking question",
    async () => {
      const run = await runToCompletion(
        "Rank all 30 portfolio entities by their YoY EBITDA growth (Actual YTD-2026-03 vs Actual YTD-2025-03). Show me the top 5 and the bottom 5, with the absolute deltas and % growth for each. Use Python — it must be a sorted ranking.",
        { scope: "PORTFOLIO_TOTAL", reportType: "chat" }
      );

      expect(run.finalStatus, run.failureError ?? "").toBe("completed");

      // Assert at least one server_tool_use block with name "code_execution".
      // server_tool_use + server_tool_result events are surfaced through the
      // same tool_call / tool_result shape by emitServerToolEvents.
      const codeCalls = run.toolCalls.filter((tc) => tc.name === "code_execution");
      expect(
        codeCalls.length,
        "agent should use code_execution for a ranking problem"
      ).toBeGreaterThanOrEqual(1);

      // The answer should cite at least 5 entities (top-5) + ideally top + bottom.
      const allCites = run.sections.flatMap((s) => s.citations);
      const distinctEntities = new Set(allCites.map((c) => c.entity)).size;
      expect(
        distinctEntities,
        "ranking should cite at least 5 distinct entities"
      ).toBeGreaterThanOrEqual(5);
    },
    10 * 60_000
  );
});
