"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Wrench, Sparkles, Database, BookOpen, PenLine, Flag, Terminal } from "lucide-react";
import { useState } from "react";

interface ToolInfo {
  name: string;
  kind?: "client" | "server";
  description: string;
  spawnsAgent: boolean;
  jsonSchema: unknown;
}

interface AgentsResponse {
  agent: {
    id: string;
    label: string;
    model: string;
    thinking: string;
    system: string;
  };
  tools: ToolInfo[];
}

const TOOL_ICON: Record<string, typeof Wrench> = {
  memory_recall: BookOpen,
  query_cube: Database,
  code_execution: Terminal,
  write_section: PenLine,
  finish: Flag,
};

export function AgentWorkbench() {
  const { data, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const r = await fetch("/api/tools");
      return (await r.json()) as AgentsResponse;
    },
  });

  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <div className="p-6 max-w-[1440px] mx-auto">
        <Skeleton className="h-10 w-80 mb-4" />
        <Skeleton className="h-[520px]" />
      </div>
    );
  }

  const tool = selectedTool ? data.tools.find((t) => t.name === selectedTool) : null;

  return (
    <div className="p-6 pb-10 max-w-[1440px] mx-auto space-y-5">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Bot className="h-3 w-3" />
          Agent Workbench
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight mt-1">UNITY Narrator agent stack</h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          A single LLM-driven orchestrator (Claude Opus 4.7) plus a library of typed tools backed
          by the Jedox cube. The orchestrator decides which tools to use and in what order — the
          DAG is not pre-declared.
        </p>
      </div>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-foreground text-background flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[15px] font-semibold">{data.agent.label}</div>
              <div className="text-[12px] text-muted-foreground font-mono">
                {data.agent.model} · thinking: {data.agent.thinking}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-medium bg-positive-soft text-positive">
              <span className="h-1.5 w-1.5 rounded-full bg-positive" />
              Live · Claude API
            </span>
          </div>
        </div>

        <Tabs defaultValue="tools" className="mt-5">
          <TabsList className="h-9">
            <TabsTrigger value="tools">Tools · {data.tools.length}</TabsTrigger>
            <TabsTrigger value="system">System prompt</TabsTrigger>
          </TabsList>
          <TabsContent value="tools" className="m-0 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-4 space-y-1">
                {data.tools.map((t) => {
                  const Icon = TOOL_ICON[t.name] ?? Wrench;
                  return (
                    <button
                      key={t.name}
                      onClick={() => setSelectedTool(t.name)}
                      className={`w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-left transition ${
                        selectedTool === t.name
                          ? "bg-accent-blue-soft border border-accent-blue/30"
                          : "bg-background border border-border/60 hover:border-border"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 text-accent-blue shrink-0" />
                      <span className="text-[12.5px] font-mono truncate flex-1">{t.name}</span>
                      {t.kind === "server" && (
                        <span className="text-[9px] font-medium uppercase tracking-[0.06em] text-muted-foreground bg-muted rounded px-1 py-0.5">
                          Anthropic
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="md:col-span-8">
                {tool ? (
                  <div className="space-y-3.5">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-medium mb-1">
                        Description
                      </div>
                      <p className="text-[13.5px] leading-relaxed">{tool.description}</p>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground font-medium mb-1.5">
                        Input schema
                      </div>
                      <pre className="text-[12px] font-mono bg-muted/40 p-3.5 rounded-md border border-border/60 overflow-x-auto leading-relaxed">
                        {JSON.stringify(tool.jsonSchema, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="text-[13px] text-muted-foreground italic p-4 text-center">
                    Select a tool to inspect its schema.
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="system" className="m-0 mt-4">
            <pre className="text-[12.5px] font-mono bg-muted/40 p-4 rounded-md border border-border/60 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[600px] overflow-y-auto scrollbar-thin">
              {data.agent.system}
            </pre>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

