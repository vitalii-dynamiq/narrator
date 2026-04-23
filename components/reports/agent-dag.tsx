"use client";

import type { RunState, NodeState } from "@/lib/agents/events";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Database,
  CheckCircle2,
  Loader2,
  ChevronDown,
  Wrench,
  BookOpen,
  PenLine,
  Flag,
  Terminal,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useElapsed } from "@/lib/hooks/use-elapsed";

const toolIcons: Record<string, typeof Sparkles> = {
  memory_recall: BookOpen,
  query_cube: Database,
  code_execution: Terminal,
  write_section: PenLine,
  finish: Flag,
};

export function AgentDag({ run }: { run: RunState }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const allNodes = Object.values(run.nodes);
  const roots = allNodes.filter((n) => !n.parentId);
  const childrenOf = (id: string) => allNodes.filter((n) => n.parentId === id);
  const childCountFor = (id: string) => allNodes.filter((n) => n.parentId === id).length;

  return (
    <div className="p-4 space-y-2">
      <div className="mb-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          Agent trace
        </div>
        <div className="text-[12.5px] mt-0.5">
          <span className="tabular-nums">{Object.values(run.nodes).length}</span> node
          {Object.values(run.nodes).length === 1 ? "" : "s"} · DAG grows as the orchestrator decides its next move
        </div>
      </div>

      <div className="space-y-1.5">
        {roots.map((root) => (
          <div key={root.id}>
            <NodeCard
              node={root}
              childCount={childCountFor(root.id)}
              isExpanded={!!expanded[root.id]}
              onToggle={() => setExpanded((s) => ({ ...s, [root.id]: !s[root.id] }))}
            />
            {/* Children nested */}
            <div className="pl-4 space-y-1 mt-1 border-l-2 border-border/60 ml-3">
              <AnimatePresence>
                {childrenOf(root.id).map((child) => (
                  <motion.div
                    key={child.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <NodeCard
                      node={child}
                      childCount={0}
                      isExpanded={!!expanded[child.id]}
                      onToggle={() => setExpanded((s) => ({ ...s, [child.id]: !s[child.id] }))}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NodeCard({
  node,
  childCount,
  isExpanded,
  onToggle,
}: {
  node: NodeState;
  childCount: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isTool = node.kind === "tool";
  const Icon = isTool
    ? (node.toolName ? toolIcons[node.toolName] : undefined) ?? Wrench
    : Sparkles;
  const liveElapsed = useElapsed(node.startedAt, node.status === "running");
  const elapsedMs =
    node.completedAt && node.startedAt ? node.completedAt - node.startedAt : liveElapsed;

  return (
    <div
      className={`rounded-md border transition-shadow ${
        isTool ? "bg-muted/30 border-border/60" : "bg-background"
      } ${
        node.status === "running"
          ? "border-accent-blue shadow-[0_0_0_3px_var(--accent-blue-bg)]"
          : node.status === "done"
          ? "border-border"
          : node.status === "error"
          ? "border-negative"
          : "border-border/60"
      }`}
    >
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2.5 px-2.5 text-left ${
          isTool ? "py-1.5" : "py-2"
        }`}
      >
        <div className="relative">
          <div
            className={`flex items-center justify-center rounded-full ${
              isTool ? "h-5 w-5" : "h-6 w-6"
            } ${
              node.status === "running"
                ? "bg-accent-blue text-background"
                : node.status === "done"
                ? "bg-positive-soft"
                : node.status === "error"
                ? "bg-negative-soft"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {node.status === "running" ? (
              <Loader2 className={`animate-spin ${isTool ? "h-3 w-3" : "h-3.5 w-3.5"}`} />
            ) : node.status === "done" ? (
              <CheckCircle2 className={`text-positive ${isTool ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
            ) : (
              <Icon className={isTool ? "h-3 w-3" : "h-3.5 w-3.5"} />
            )}
          </div>
          {node.status === "running" && !isTool && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-accent-blue"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 1.6, opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`truncate ${isTool ? "text-[11.5px] font-mono" : "text-[12.5px] font-medium"}`}
            >
              {node.label}
            </span>
          </div>
          {!isTool && node.model && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
              <span className="font-mono">{node.model.replace("claude-", "")}</span>
              <span>·</span>
              <span>{childCount} tool calls</span>
              {(node.tokensIn > 0 || node.tokensOut > 0) && (
                <>
                  <span>·</span>
                  <span className="tabular-nums">{node.tokensIn + node.tokensOut} tok</span>
                </>
              )}
              {node.tokensCached > 0 && (
                <>
                  <span>·</span>
                  <span className="tabular-nums text-positive">{node.tokensCached} cached</span>
                </>
              )}
              {elapsedMs > 0 && (
                <>
                  <span>·</span>
                  <span className="tabular-nums">{(elapsedMs / 1000).toFixed(1)}s</span>
                </>
              )}
            </div>
          )}
          {isTool && (
            <div className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
              {node.status === "running"
                ? "running…"
                : node.output && typeof node.output === "object" && "summary" in node.output
                ? String((node.output as { summary?: string }).summary ?? "done")
                : "done"}
              {elapsedMs > 0 && ` · ${elapsedMs}ms`}
            </div>
          )}
        </div>
        <ChevronDown
          className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="border-t border-border/70 overflow-hidden"
          >
            <NodeDetail node={node} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NodeDetail({ node }: { node: NodeState }) {
  const hasThinking = node.thinking.length > 0;
  const hasTools = node.toolCalls.length > 0;
  const hasOutput = node.output !== null && node.output !== undefined;
  const hasInput = node.kind === "tool" && node.toolInput !== undefined;

  return (
    <div className="p-2">
      <Tabs defaultValue={hasInput ? "input" : hasThinking ? "thinking" : "output"}>
        <TabsList className="h-7 text-[10.5px]">
          {hasInput && <TabsTrigger value="input">Input</TabsTrigger>}
          {hasThinking && <TabsTrigger value="thinking">Thinking</TabsTrigger>}
          {hasTools && <TabsTrigger value="tools">Tools · {node.toolCalls.length}</TabsTrigger>}
          <TabsTrigger value="output">Output</TabsTrigger>
          {node.textDelta.length > 0 && <TabsTrigger value="text">Text</TabsTrigger>}
        </TabsList>
        {hasInput && (
          <TabsContent value="input" className="m-0 mt-2">
            <pre className="max-h-52 overflow-y-auto scrollbar-thin whitespace-pre-wrap break-words text-[10.5px] leading-relaxed font-mono bg-background p-2 rounded border border-border/60">
              {JSON.stringify(node.toolInput, null, 2)}
            </pre>
          </TabsContent>
        )}
        {hasThinking && (
          <TabsContent value="thinking" className="m-0 mt-2">
            <pre className="max-h-52 overflow-y-auto scrollbar-thin whitespace-pre-wrap break-words text-[10.5px] leading-relaxed text-muted-foreground font-mono bg-background p-2 rounded border border-border/60">
              {node.thinking}
            </pre>
          </TabsContent>
        )}
        {hasTools && (
          <TabsContent value="tools" className="m-0 mt-2 space-y-1">
            {node.toolCalls.map((t) => (
              <div
                key={t.callId}
                className="rounded border border-border/60 bg-background px-2 py-1 text-[10.5px] font-mono"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-accent-blue">{t.name}</span>
                  <span className="text-muted-foreground">
                    {t.status === "done" ? `${t.ms ?? 0}ms` : "running…"}
                  </span>
                </div>
                <div className="text-muted-foreground truncate mt-0.5">
                  {JSON.stringify(t.input).slice(0, 160)}
                </div>
              </div>
            ))}
          </TabsContent>
        )}
        <TabsContent value="output" className="m-0 mt-2">
          {hasOutput ? (
            <pre className="max-h-52 overflow-y-auto scrollbar-thin whitespace-pre-wrap break-words text-[10.5px] leading-relaxed font-mono bg-background p-2 rounded border border-border/60">
              {JSON.stringify(node.output, null, 2).slice(0, 2400)}
            </pre>
          ) : (
            <div className="text-[11px] text-muted-foreground italic p-2">No output yet.</div>
          )}
        </TabsContent>
        {node.textDelta.length > 0 && (
          <TabsContent value="text" className="m-0 mt-2">
            <pre className="max-h-52 overflow-y-auto scrollbar-thin whitespace-pre-wrap break-words text-[11px] leading-relaxed bg-background p-2 rounded border border-border/60">
              {node.textDelta}
            </pre>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
