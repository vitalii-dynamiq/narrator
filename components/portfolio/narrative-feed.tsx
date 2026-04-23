"use client";

import { Card } from "@/components/ui/card";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { PortfolioResponse } from "./portfolio-overview";

export function NarrativeFeed({ insights }: { insights: PortfolioResponse["insights"] }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[13px] font-semibold flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-accent-blue" />
            Narrative feed
          </div>
          <div className="text-[11px] text-muted-foreground">
            Insights surfaced by Claude agents during the Q1 close — each maps back to a cube slice.
          </div>
        </div>
      </div>
      <ul className="space-y-2">
        {insights.map((i, idx) => (
          <li
            key={idx}
            className="flex items-start gap-3 rounded-md border border-border/60 bg-background p-3 transition hover:border-border"
          >
            <div className="h-6 w-6 shrink-0 rounded-full bg-accent-blue/10 flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-accent-blue" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <Link
                  href={`/entity/${i.entity}`}
                  className="text-[12.5px] font-medium hover:text-accent-blue transition"
                >
                  {i.title}
                </Link>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {i.agent}
                </span>
              </div>
              <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">{i.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
