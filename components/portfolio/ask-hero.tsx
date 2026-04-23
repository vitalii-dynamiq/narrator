"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const SUGGESTED = [
  "Why did Fortuna DE underperform this quarter?",
  "Walk me through the Atlas NL fair value bridge.",
  "Top 3 EBITDA detractors in Buyouts — what happened?",
  "Where is Management forecast diverging from PIL?",
];

export function AskHero() {
  const [draft, setDraft] = useState("");
  const router = useRouter();

  const submit = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/ask?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <div className="mb-3">
        <div className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
          Ask UNITY
        </div>
        <div className="text-[15px] text-foreground/90 mt-0.5">
          Any question about the portfolio — UNITY investigates and answers with citations.
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
        className="relative"
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Why is EBITDA down this quarter? &nbsp;·&nbsp;  What drove the Atlas NL fair-value change?"
          className="pr-14 min-h-[76px] resize-none text-[15px] bg-muted/40 border-border focus-visible:ring-accent-blue/30"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(draft);
            }
          }}
        />
        <Button
          type="submit"
          size="sm"
          disabled={!draft.trim()}
          className="absolute bottom-2.5 right-2.5 h-9 w-9 p-0"
          aria-label="Ask"
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {SUGGESTED.map((q) => (
          <button
            key={q}
            onClick={() => submit(q)}
            className="rounded-full border border-border bg-background px-3 py-1 text-[12.5px] text-foreground/80 hover:border-accent-blue hover:text-accent-blue transition"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
