"use client";

import type { SectionDoc } from "@/lib/agents/events";
import { MarkdownContent } from "./markdown-content";

interface Props {
  section: SectionDoc;
  streaming?: boolean;
}

const SECTION_LABEL: Record<string, string> = {
  "exec-summary": "Executive Summary",
  "pl-performance": "P&L Performance",
  "balance-sheet-cashflow": "Balance Sheet & Cash Flow",
  "forward-view": "Forward View",
  "fv-bridge": "Fair-Value Bridge",
  "underlying-performance": "Underlying Performance",
};

// Defensive scrubber: in case the model forgets the no-"From memory" rule, we
// strip the leading marker so the reader never sees UI chrome about memory.
function scrubMemoryMarkers(body: string): string {
  return body
    .replace(/^\s*📌\s*From memory:\s*/gim, "")
    .replace(/\n\n\s*📌\s*From memory:\s*/g, "\n\n");
}

export function SectionCard({ section, streaming = false }: Props) {
  const displayTitle = section.title || SECTION_LABEL[section.id] || section.id;
  const kind = section.id.startsWith("fv-")
    ? "valuation"
    : ["balance-sheet-cashflow", "forward-view"].includes(section.id)
    ? "operations"
    : "primary";
  const body = scrubMemoryMarkers(section.body);

  return (
    <article
      className={`rounded-xl border shadow-[0_1px_0_0_rgba(0,0,0,0.03)] bg-background ${
        kind === "primary"
          ? "border-border/80"
          : kind === "valuation"
          ? "border-accent-blue/20"
          : "border-border/70"
      }`}
      id={`section-${section.id}`}
    >
      <header className="px-6 pt-5 pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] uppercase tracking-[0.08em] font-medium text-muted-foreground">
            {kindLabel(kind)}
          </span>
          {streaming && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-blue animate-pulse" />
          )}
        </div>
        <h1 className="mt-1 text-[20px] font-semibold tracking-tight text-foreground">
          {displayTitle}
        </h1>
      </header>
      <div className="px-6 py-5">
        <MarkdownContent body={body} citations={section.citations ?? []} />
      </div>
      {(section.citations?.length ?? 0) > 0 && (
        <footer className="px-6 py-2 border-t border-border/50 bg-muted/25 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <span className="tabular-nums">{section.citations!.length}</span>
          <span>citation{section.citations!.length === 1 ? "" : "s"} · verified against the cube</span>
        </footer>
      )}
    </article>
  );
}

function kindLabel(k: "primary" | "valuation" | "operations"): string {
  switch (k) {
    case "valuation":
      return "Valuation";
    case "operations":
      return "Operations";
    default:
      return "Commentary";
  }
}
