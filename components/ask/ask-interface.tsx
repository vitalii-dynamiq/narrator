"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, User, AlertTriangle, FileText, Square } from "lucide-react";
import { useRunStream } from "@/lib/hooks/use-run-stream";
import type { RunState } from "@/lib/agents/events";
import { LogoMark } from "@/components/shell/logo";
import { MarkdownContent } from "./markdown-content";
import { AgentTimeline } from "./agent-timeline";
import { SectionCard } from "./section-card";
import { EvidenceDrawer } from "./evidence-drawer";
import { useRunStore } from "@/lib/store/run";
import { useShallow } from "zustand/react/shallow";
import { ConversationIdProvider } from "./conversation-context";

const SUGGESTED = [
  "Why did Fortuna DE underperform this quarter?",
  "Walk me through the Atlas NL fair value bridge.",
  "Top 3 EBITDA detractors across the portfolio.",
  "Where is Management forecast most divergent from PIL?",
  "Are there any accelerating trends I should know about?",
];

interface Turn {
  id: string;
  question: string;
  runId: string;
}

export function AskInterface({ initialQuestion }: { initialQuestion: string }) {
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  // Conversation id is assigned by the server on the first POST and reused on
  // every subsequent turn so Opus 4.7 sees the full prior-turn context.
  // Can also be seeded via ?conv= on the URL — that's how "Explain this
  // number" lands back in the original chat.
  const [conversationId, setConversationId] = useState<string | null>(
    () => searchParams.get("conv")
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAutoSubmitted = useRef<string | null>(null);

  const submit = useMutation({
    mutationFn: async (question: string) => {
      const r = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          reportType: "chat",
          conversationId: conversationId ?? undefined,
        }),
      });
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as { runId: string; conversationId: string };
    },
    onSuccess: ({ runId, conversationId: newId }, question) => {
      if (!conversationId) setConversationId(newId);
      setTurns((t) => [...t, { id: runId, question, runId }]);
      setDraft("");
    },
  });

  // Auto-submit when the ?q= param lands or changes. Guarded so we don't re-fire
  // the same question twice, but does fire for distinct new ones.
  useEffect(() => {
    const q = searchParams.get("q") ?? initialQuestion;
    const trimmed = q?.trim();
    if (!trimmed) return;
    if (lastAutoSubmitted.current === trimmed) return;
    if (submit.isPending) return;
    lastAutoSubmitted.current = trimmed;
    submit.mutate(trimmed);
  }, [searchParams, initialQuestion, submit]);

  useEffect(() => {
    if (turns.length > 0) {
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: "smooth",
        })
      );
    }
  }, [turns.length]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  // Pull the RunStates for every turn so the evidence drawer can aggregate.
  // Stable shallow equality avoids re-rendering on unrelated store updates.
  const runs = useRunStore(
    useShallow((s) =>
      turns.map((t) => s.runs[t.runId]).filter((r): r is RunState => !!r)
    )
  );
  const totalCites = runs.reduce(
    (acc, r) =>
      acc +
      Object.values(r.sections).reduce(
        (s, sec) => s + (sec.citations?.length ?? 0),
        0
      ),
    0
  );

  // Keyboard shortcuts: ⌘E toggle drawer, ⌘K focus input.
  const formRef = useRef<HTMLFormElement>(null);
  // Latest running turn — used by the Esc handler to pick a cancel target.
  const latestRunning = runs[runs.length - 1];
  const latestRunningTurnId = turns[turns.length - 1]?.runId ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setDrawerOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        formRef.current?.querySelector("textarea")?.focus();
      }
      // Esc cancels the in-flight run (if any) without stealing focus from
      // other modals. Only when the latest turn is running.
      if (
        e.key === "Escape" &&
        (submit.isPending ||
          latestRunning?.status === "running" ||
          latestRunning?.status === "pending")
      ) {
        if (latestRunningTurnId) {
          fetch(`/api/runs/${latestRunningTurnId}/cancel`, { method: "POST" }).catch(
            () => undefined
          );
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit.isPending, latestRunning, latestRunningTurnId]);

  const empty = turns.length === 0;
  const mainShift = drawerOpen ? "md:pr-[380px]" : "";

  // Latest turn's run status — used to swap Send ↔ Stop in the composer.
  const latestRun = runs[runs.length - 1];
  const isStreaming =
    submit.isPending ||
    (latestRun?.status === "running" || latestRun?.status === "pending");

  const stopLatest = async () => {
    const latestTurn = turns[turns.length - 1];
    if (!latestTurn) return;
    try {
      await fetch(`/api/runs/${latestTurn.runId}/cancel`, { method: "POST" });
    } catch {
      // Noop — network flakes are acceptable on user-initiated cancel.
    }
  };

  return (
    <ConversationIdProvider value={conversationId}>
    <div className={`flex flex-col h-[calc(100vh-52px)] transition-[padding] duration-200 ${mainShift}`}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="mx-auto max-w-[820px] px-4 md:px-6">
          {empty && <HeroBlock onPick={(q) => submit.mutate(q)} />}
          {!empty && (
            <div className="py-6 space-y-10">
              {turns.map((t) => (
                <TurnBlock key={t.id} turn={t} />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="border-t border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto max-w-[820px] px-4 md:px-6 py-3">
          {totalCites > 0 && !drawerOpen && (
            <div className="mb-2 flex justify-end">
              <button
                onClick={() => setDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11.5px] text-foreground/85 hover:border-accent-blue hover:text-accent-blue transition"
                title="⌘E"
              >
                <FileText className="h-3 w-3" strokeWidth={2.2} />
                <span>Evidence · {totalCites}</span>
              </button>
            </div>
          )}
          <form
            ref={formRef}
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) submit.mutate(draft.trim());
            }}
            className="relative"
          >
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                turns.length === 0
                  ? "Ask UNITY anything about the portfolio…"
                  : "Ask a follow-up — prior context is preserved…"
              }
              className="pr-14 min-h-[58px] resize-none text-[15px] border-border focus-visible:ring-accent-blue/30 bg-muted/30"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (draft.trim()) submit.mutate(draft.trim());
                }
              }}
            />
            {isStreaming ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="absolute bottom-2.5 right-2.5 h-9 w-9 p-0"
                aria-label="Stop"
                title="Stop · Esc"
                onClick={(e) => {
                  e.preventDefault();
                  stopLatest();
                }}
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                disabled={!draft.trim()}
                className="absolute bottom-2.5 right-2.5 h-9 w-9 p-0"
                aria-label="Submit"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </form>
          <div className="text-[11.5px] text-muted-foreground mt-2 flex items-center gap-3">
            <span>Enter to ask · Shift+Enter for a new line</span>
            <span className="text-muted-foreground/70">·</span>
            <span className="text-muted-foreground/70">⌘E evidence · ⌘K focus · Esc stop</span>
          </div>
        </div>
      </div>
      <EvidenceDrawer open={drawerOpen} onOpenChange={setDrawerOpen} runs={runs} />
    </div>
    </ConversationIdProvider>
  );
}

function HeroBlock({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="py-20 flex flex-col items-center gap-7 text-center">
      <LogoMark size={48} />
      <div className="space-y-2">
        <h1 className="text-[30px] font-semibold tracking-tight leading-tight">
          Ask UNITY anything
        </h1>
        <p className="text-[14.5px] text-muted-foreground max-w-lg leading-relaxed">
          Ask any question about the portfolio. UNITY investigates the reporting cube and answers
          with citations back to the source cells.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 max-w-xl justify-center">
        {SUGGESTED.map((q) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="rounded-full border border-border bg-background px-3.5 py-1.5 text-[13px] text-foreground/85 hover:border-accent-blue hover:text-accent-blue transition"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function TurnBlock({ turn }: { turn: Turn }) {
  const run = useRunStream(turn.runId);
  return (
    <div className="space-y-5">
      {/* User question */}
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 pt-1 text-[15px] leading-snug">{turn.question}</div>
      </div>

      {/* Agent response */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          <LogoMark size={32} />
        </div>
        <div className="flex-1 min-w-0">
          {!run && (
            <div className="text-[13px] text-muted-foreground italic">Spawning orchestrator…</div>
          )}
          {run && <AgentResponse run={run} />}
        </div>
      </div>
    </div>
  );
}

function AgentResponse({ run }: { run: RunState }) {
  const orchestrator = Object.values(run.nodes).find((n) => n.kind === "agent");
  const sections = Object.values(run.sections).sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      {run.status === "failed" && run.error && <FailureBanner error={run.error} />}

      {/* Unified agent timeline — thinking + tool calls interleaved in chronological order */}
      <AgentTimeline run={run} />

      {/* Sections as visually distinct cards */}
      <div className="space-y-4">
        {sections.map((s) => (
          <SectionCard key={s.id} section={s} streaming={run.status === "running"} />
        ))}
      </div>

      {/* Conversational tail (if the agent added prose outside sections) */}
      {orchestrator && orchestrator.textDelta.length > 0 && (
        <div className={run.status === "running" ? "streaming-cursor" : ""}>
          <MarkdownContent body={orchestrator.textDelta} />
        </div>
      )}

      {/* Completed but no output */}
      {run.status === "completed" && sections.length === 0 && !orchestrator?.textDelta && (
        <div className="text-[13px] text-muted-foreground italic">
          The agent finished but didn&rsquo;t produce a written section. Try a narrower scope.
        </div>
      )}
    </div>
  );
}

function FailureBanner({ error }: { error: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-destructive/30 bg-destructive/[0.06] px-3 py-2 text-[12.5px] leading-snug text-destructive">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-[2px]" strokeWidth={2.2} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold mb-0.5">Run failed</div>
        <div className="text-destructive/90 break-words">{error}</div>
      </div>
    </div>
  );
}

