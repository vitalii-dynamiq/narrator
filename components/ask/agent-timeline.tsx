"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  ChevronDown,
  Database,
  BookOpen,
  PenLine,
  Flag,
  Terminal,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { RunState, TimelineEntry } from "@/lib/agents/events";
import { useElapsed } from "@/lib/hooks/use-elapsed";

const TOOL_ICONS: Record<string, typeof Wrench> = {
  memory_recall: BookOpen,
  query_cube: Database,
  code_execution: Terminal,
  write_section: PenLine,
  finish: Flag,
};

export function AgentTimeline({ run }: { run: RunState }) {
  const [open, setOpen] = useState(true);
  const wasRunning = useRef(run.status === "running");

  // Auto-collapse when transitioning from running to completed.
  useEffect(() => {
    if (wasRunning.current && run.status !== "running") setOpen(false);
    wasRunning.current = run.status === "running";
  }, [run.status]);

  const isRunning = run.status === "running";
  const toolCount = run.timeline.filter((t) => t.kind === "tool").length;
  const startedAt = run.startedAt;
  const completedAt = run.completedAt;

  const liveElapsed = useElapsed(startedAt, isRunning);
  const elapsedMs = completedAt ? completedAt - startedAt : liveElapsed;
  const seconds = Math.max(1, Math.round(elapsedMs / 1000));

  if (run.timeline.length === 0 && !isRunning) return null;

  return (
    <div className="rounded-lg border border-border/80 bg-muted/25 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-[13px] text-foreground/85 hover:bg-muted/50 transition"
      >
        <span className="flex items-center gap-2">
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-blue" />
          ) : (
            <Brain className="h-3.5 w-3.5 text-accent-blue" />
          )}
          <span className="font-medium">
            {isRunning ? "Working…" : `Thought for ${seconds}s`}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {toolCount} tool call{toolCount === 1 ? "" : "s"}
          </span>
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-border/70"
          >
            <div className="px-3 py-3 max-h-[480px] overflow-y-auto scrollbar-thin">
              <ol className="space-y-2.5">
                {run.timeline.map((entry, i) => (
                  <li key={entry.id}>
                    {entry.kind === "thinking" ? (
                      <ThinkingRow
                        entry={entry}
                        isLast={i === run.timeline.length - 1 && isRunning}
                      />
                    ) : (
                      <ToolRow entry={entry} />
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ThinkingRow({
  entry,
  isLast,
}: {
  entry: Extract<TimelineEntry, { kind: "thinking" }>;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-2.5">
      <div className="shrink-0 w-4 flex justify-center pt-1">
        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
      </div>
      <div className="flex-1 min-w-0 text-[13px] leading-[1.6] text-muted-foreground whitespace-pre-wrap">
        {entry.text}
        {isLast && (
          <span className="inline-block w-1.5 h-3 bg-accent-blue/70 ml-0.5 align-baseline animate-pulse" />
        )}
      </div>
    </div>
  );
}

function ToolRow({ entry }: { entry: Extract<TimelineEntry, { kind: "tool" }> }) {
  if (entry.name === "code_execution") return <CodeExecutionRow entry={entry} />;
  return <StandardToolRow entry={entry} />;
}

function StandardToolRow({ entry }: { entry: Extract<TimelineEntry, { kind: "tool" }> }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOOL_ICONS[entry.name] ?? Wrench;
  const running = entry.status === "running";
  const summary =
    entry.output && typeof entry.output === "object" && "summary" in entry.output
      ? String((entry.output as { summary?: string }).summary ?? "")
      : "";
  const inputPreview = truncate(JSON.stringify(entry.input), 72);

  return (
    <div className="rounded-md border border-border/70 bg-background">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left"
      >
        <div
          className={`h-5 w-5 rounded-sm flex items-center justify-center shrink-0 ${
            running
              ? "bg-accent-blue/15 text-accent-blue"
              : "bg-positive-soft text-positive"
          }`}
        >
          {running ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
        </div>
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-mono text-[12.5px] font-semibold truncate">{entry.name}</span>
        <span className="font-mono text-[11.5px] text-muted-foreground truncate flex-1">
          {inputPreview}
        </span>
        {entry.ms !== undefined && (
          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
            {entry.ms}ms
          </span>
        )}
        <ChevronDown
          className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-border/60 bg-muted/30"
          >
            <div className="px-3 py-2.5 space-y-2">
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-medium mb-1">
                  Arguments
                </div>
                <pre className="text-[11.5px] font-mono whitespace-pre-wrap break-words">
                  {JSON.stringify(entry.input, null, 2)}
                </pre>
              </div>
              {summary && (
                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-medium mb-1">
                    Result
                  </div>
                  <div className="text-[12.5px] text-foreground/80">{summary}</div>
                </div>
              )}
              {entry.cellsRead && entry.cellsRead.length > 0 && (
                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-medium mb-1">
                    Cells read · {entry.cellsRead.length}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {entry.cellsRead.slice(0, 6).map((c, i) => (
                      <span
                        key={i}
                        className="rounded bg-muted px-1.5 py-0.5 text-[10.5px] font-mono text-muted-foreground"
                      >
                        {c.entity}·{c.account}·{c.time}
                      </span>
                    ))}
                    {entry.cellsRead.length > 6 && (
                      <span className="text-[10.5px] text-muted-foreground">
                        +{entry.cellsRead.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CodeExecutionRow({ entry }: { entry: Extract<TimelineEntry, { kind: "tool" }> }) {
  const [expanded, setExpanded] = useState(true);
  const running = entry.status === "running";
  const code = codeFromInput(entry.input);
  const result = parseCodeExecResult(entry.output);
  const returnCode = result?.return_code;
  const hasError = returnCode !== undefined && returnCode !== 0;

  return (
    <div
      className={`rounded-md border bg-background ${
        hasError ? "border-destructive/40" : "border-accent-blue/30"
      }`}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left"
      >
        <div
          className={`h-5 w-5 rounded-sm flex items-center justify-center shrink-0 ${
            running
              ? "bg-accent-blue/15 text-accent-blue"
              : hasError
              ? "bg-destructive/10 text-destructive"
              : "bg-accent-blue-soft text-accent-blue"
          }`}
        >
          {running ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : hasError ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <Terminal className="h-3.5 w-3.5" />
          )}
        </div>
        <span className="font-mono text-[12.5px] font-semibold">code_execution</span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {code.split("\n").length} line{code.split("\n").length === 1 ? "" : "s"} Python
        </span>
        {result && result.return_code === 0 && result.stdout && (
          <span className="text-[11px] text-muted-foreground truncate flex-1 italic">
            → {truncate(result.stdout.replace(/\s+/g, " ").trim(), 80)}
          </span>
        )}
        {!result && <span className="flex-1" />}
        {entry.ms !== undefined && (
          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
            {entry.ms}ms
          </span>
        )}
        <ChevronDown
          className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-t border-border/60"
          >
            <div className="space-y-0">
              <div className="bg-muted/40 px-3 py-2">
                <div className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-medium mb-1">
                  Python
                </div>
                <pre className="text-[11.5px] font-mono whitespace-pre-wrap break-words leading-[1.55]">
                  {code || "(empty)"}
                </pre>
              </div>
              {result && result.stdout && (
                <div className="border-t border-border/50 bg-background/50 px-3 py-2">
                  <div className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground font-medium mb-1">
                    Stdout
                  </div>
                  <pre className="text-[11.5px] font-mono whitespace-pre-wrap break-words leading-[1.5] text-foreground/90">
                    {result.stdout}
                  </pre>
                </div>
              )}
              {result && result.stderr && result.stderr.trim() && (
                <div className="border-t border-border/50 bg-destructive/[0.04] px-3 py-2">
                  <div className="text-[10.5px] uppercase tracking-[0.06em] text-destructive font-medium mb-1">
                    Stderr
                  </div>
                  <pre className="text-[11.5px] font-mono whitespace-pre-wrap break-words leading-[1.5] text-destructive/90">
                    {result.stderr}
                  </pre>
                </div>
              )}
              {result && result.return_code !== undefined && result.return_code !== 0 && (
                <div className="border-t border-border/50 bg-destructive/[0.04] px-3 py-1.5 text-[11px] text-destructive font-mono">
                  exit {result.return_code}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function codeFromInput(input: unknown): string {
  if (input && typeof input === "object" && "code" in input) {
    const c = (input as { code?: unknown }).code;
    if (typeof c === "string") return c;
  }
  return "";
}

interface ParsedCodeExecResult {
  stdout?: string;
  stderr?: string;
  return_code?: number;
}

function parseCodeExecResult(output: unknown): ParsedCodeExecResult | null {
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;
  // Block shape from Anthropic: { type: "code_execution_result", stdout, stderr, return_code, content: [...] }
  if (o.type === "code_execution_result") {
    return {
      stdout: typeof o.stdout === "string" ? o.stdout : "",
      stderr: typeof o.stderr === "string" ? o.stderr : "",
      return_code: typeof o.return_code === "number" ? o.return_code : undefined,
    };
  }
  if (o.type === "code_execution_tool_result_error" && typeof o.error_code === "string") {
    return { stderr: o.error_code, return_code: 1 };
  }
  return null;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
