// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EvidenceDrawer } from "@/components/ask/evidence-drawer";
import type { RunState } from "@/lib/agents/events";

function makeRun(sections: Array<{
  id: string;
  title: string;
  citations: Array<{
    id: number;
    entity: string;
    account: string;
    period: string;
    version: string;
    value: number;
  }>;
}>): RunState {
  return {
    runId: "run_test",
    status: "completed",
    error: null,
    nodes: {},
    edges: [],
    sections: Object.fromEntries(
      sections.map((s) => [
        s.id,
        { id: s.id, title: s.title, body: "", citations: s.citations, order: 0 },
      ])
    ),
    timeline: [],
    cacheTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    startedAt: 0,
    completedAt: 0,
    dagReady: true,
  };
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

describe("EvidenceDrawer — aggregation", () => {
  it("shows a zero-state message when there are no citations", () => {
    render(wrap(<EvidenceDrawer open={true} onOpenChange={() => {}} runs={[]} />));
    expect(
      screen.getByText((t) => t.includes("No references yet"))
    ).toBeInTheDocument();
  });

  it("groups citations by entity and deduplicates within an entity", () => {
    const run = makeRun([
      {
        id: "exec-summary",
        title: "Exec",
        citations: [
          {
            id: 1,
            entity: "ENT_FORTUNA_DE",
            account: "Revenue",
            period: "YTD-2026-03",
            version: "Actual",
            value: 100,
          },
          {
            id: 2,
            entity: "ENT_FORTUNA_DE",
            account: "Revenue",
            period: "YTD-2026-03",
            version: "Actual",
            value: 100,
          }, // dup
          {
            id: 3,
            entity: "ENT_ATLAS_NL",
            account: "FairValue",
            period: "2026-03",
            version: "Valuation-V2",
            value: 500,
          },
        ],
      },
    ]);
    render(wrap(<EvidenceDrawer open={true} onOpenChange={() => {}} runs={[run]} />));
    // Header shows total unique cells = 2
    expect(screen.getByText(/· 2 cells/)).toBeInTheDocument();
    // Both entity groups present
    expect(screen.getByText(/FORTUNA DE/)).toBeInTheDocument();
    expect(screen.getByText(/ATLAS NL/)).toBeInTheDocument();
  });

  it("exposes a data-filter-chip on every filter pill (for keyboard + test targeting)", () => {
    const run = makeRun([
      {
        id: "exec-summary",
        title: "Exec",
        citations: [
          {
            id: 1,
            entity: "ENT_ATLAS_NL",
            account: "FairValue",
            period: "2026-03",
            version: "Valuation-V2",
            value: 500,
          },
        ],
      },
    ]);
    const { container } = render(
      wrap(<EvidenceDrawer open={true} onOpenChange={() => {}} runs={[run]} />)
    );
    // All five filter chips are tagged (all, income, balance, cashflow, valuation).
    const chips = container.querySelectorAll("button[data-filter-chip]");
    expect(chips.length).toBe(5);
    const ids = Array.from(chips).map((c) => c.getAttribute("data-filter-chip"));
    expect(ids).toContain("valuation");
  });
});
