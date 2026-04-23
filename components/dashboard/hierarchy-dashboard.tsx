"use client";

import { useQuery } from "@tanstack/react-query";
import { StatementTable } from "./statement-table";
import { HierarchyHeader } from "./hierarchy-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { VarianceWaterfall } from "./variance-waterfall";
import { CommentaryPanel } from "./commentary-panel";

interface Props {
  id: string;
  level: "entity" | "project" | "group" | "total";
}

export function HierarchyDashboard({ id, level }: Props) {
  const { data: meta, isLoading: metaLoading } = useQuery({
    queryKey: ["entity", id],
    queryFn: async () => {
      const r = await fetch(`/api/entities/${id}`);
      if (!r.ok) throw new Error("entity fetch failed");
      return r.json();
    },
  });

  const { data: stmt, isLoading: stmtLoading } = useQuery({
    queryKey: ["stmt", id],
    queryFn: async () => {
      const r = await fetch(`/api/statements/${id}`);
      if (!r.ok) throw new Error("statements fetch failed");
      return r.json();
    },
  });

  if (metaLoading || !meta) {
    return (
      <div className="p-6 max-w-[1440px] mx-auto space-y-4">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-5 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 pb-10 max-w-[1440px] mx-auto space-y-5">
      <HierarchyHeader meta={meta} level={level} />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 xl:col-span-8 space-y-4">
          <Card className="p-0 overflow-hidden">
            <Tabs defaultValue="PL" className="w-full">
              <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4">
                <TabsList className="bg-transparent h-10">
                  <TabsTrigger value="PL">P&amp;L</TabsTrigger>
                  <TabsTrigger value="BS">Balance Sheet</TabsTrigger>
                  <TabsTrigger value="CF">Cash Flow</TabsTrigger>
                  <TabsTrigger value="KPI">KPIs</TabsTrigger>
                </TabsList>
                <div className="text-[11px] text-muted-foreground">
                  YTD · Mar 2026 · €, reporting currency
                </div>
              </div>
              {(["PL", "BS", "CF", "KPI"] as const).map((k) => (
                <TabsContent key={k} value={k} className="m-0 p-0">
                  {stmtLoading || !stmt ? (
                    <div className="p-4 space-y-1">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <Skeleton key={i} className="h-6 w-full" />
                      ))}
                    </div>
                  ) : (
                    <StatementTable
                      rows={stmt.statements[k]}
                      entity={id}
                      ytdPeriod={stmt.ytdPeriod}
                      ytdPyPeriod={stmt.ytdPyPeriod}
                      asOfPeriod={stmt.asOfPeriod}
                      showForecast={k === "PL"}
                    />
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </Card>

          <VarianceWaterfall entityId={id} />
        </div>

        <div className="col-span-12 xl:col-span-4">
          <CommentaryPanel entityId={id} meta={meta} />
        </div>
      </div>
    </div>
  );
}
