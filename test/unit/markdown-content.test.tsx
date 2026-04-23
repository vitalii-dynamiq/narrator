// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MarkdownContent } from "@/components/ask/markdown-content";
import type { SectionCitation } from "@/lib/agents/events";

const citations: SectionCitation[] = [
  {
    id: 1,
    entity: "ENT_FORTUNA_DE",
    account: "Revenue",
    period: "YTD-2026-03",
    version: "Actual",
    value: 104184908.42,
  },
];

describe("MarkdownContent — citation parsing", () => {
  it("renders a [cite:N] marker as a numbered chip", () => {
    render(
      <MarkdownContent
        body="Revenue €104.2M [cite:1]."
        citations={citations}
      />
    );
    // CitationChip renders the number as a trigger label.
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders a dangling marker as an error superscript (not a chip)", () => {
    render(<MarkdownContent body="Dangling [cite:99]." citations={citations} />);
    // Dangling marker uses the "[N?]" fallback rendering.
    expect(screen.getByText("[99?]")).toBeInTheDocument();
  });

  it("preserves plain prose around markers", () => {
    render(
      <MarkdownContent
        body="Revenue €104.2M [cite:1] landed below Budget."
        citations={citations}
      />
    );
    // The surrounding text should still be rendered.
    expect(
      screen.getByText((content) => content.includes("landed below Budget"))
    ).toBeInTheDocument();
  });
});

describe("MarkdownContent — tables and headings", () => {
  it("renders a markdown table with thead/tbody", () => {
    const body = `| Metric | Actual | Budget |
| --- | --- | --- |
| Revenue | 104.2 | 114.4 |
`;
    const { container } = render(<MarkdownContent body={body} citations={[]} />);
    expect(container.querySelector("table")).toBeInTheDocument();
    expect(container.querySelector("thead")).toBeInTheDocument();
    expect(container.querySelector("tbody")).toBeInTheDocument();
  });

  it("renders h1 via custom mapping (not downgraded to h3)", () => {
    const { container } = render(
      <MarkdownContent body={"# A heading\n\nbody."} citations={[]} />
    );
    // The renderer maps h1 to h2 (section-card already owns the visible h1).
    expect(container.querySelector("h2")).toBeInTheDocument();
    expect(container.querySelector("h2")?.textContent).toBe("A heading");
  });
});
