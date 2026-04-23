"use client";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Building2, Folder, Sparkles, Layers, Database, FileText } from "lucide-react";

interface EntityItem {
  id: string;
  label: string;
  level: "total" | "group" | "project" | "entity";
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { data } = useQuery({
    queryKey: ["entities-catalog"],
    queryFn: async () => {
      const res = await fetch("/api/entities");
      const j = await res.json();
      return j.entities as EntityItem[];
    },
    staleTime: 5 * 60_000,
  });

  const go = (path: string) => {
    router.push(path);
    onOpenChange(false);
  };

  const routeForEntity = (e: EntityItem) => {
    switch (e.level) {
      case "total":
        return "/";
      case "group":
        return `/group/${e.id}`;
      case "project":
        return `/project/${e.id}`;
      case "entity":
        return `/entity/${e.id}`;
    }
  };

  const iconForEntity = (level: EntityItem["level"]) => {
    switch (level) {
      case "total":
        return <Layers className="h-3.5 w-3.5 text-muted-foreground" />;
      case "group":
        return <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />;
      case "project":
        return <Folder className="h-3.5 w-3.5 text-muted-foreground" />;
      case "entity":
        return <Building2 className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const groups = data?.filter((e) => e.level === "group") ?? [];
  const projects = data?.filter((e) => e.level === "project") ?? [];
  const entities = data?.filter((e) => e.level === "entity") ?? [];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Command menu" description="Jump anywhere in UNITY.">
      <CommandInput placeholder="Search entities, run reports, inspect cubes…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/ask")} value="ask unity generate commentary">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            Ask UNITY…
          </CommandItem>
          <CommandItem onSelect={() => go("/model")} value="data model explorer cube schema rules">
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
            Open Data Model Explorer
          </CommandItem>
          <CommandItem onSelect={() => go("/variance/PORTFOLIO_TOTAL")} value="variance deep dive">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            Variance deep-dive (portfolio)
          </CommandItem>
        </CommandGroup>

        {groups.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Consolidated groups">
              {groups.map((e) => (
                <CommandItem
                  key={e.id}
                  value={`${e.label} ${e.id} group`}
                  onSelect={() => go(routeForEntity(e))}
                >
                  {iconForEntity(e.level)}
                  {e.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects">
              {projects.map((e) => (
                <CommandItem
                  key={e.id}
                  value={`${e.label} ${e.id} project`}
                  onSelect={() => go(routeForEntity(e))}
                >
                  {iconForEntity(e.level)}
                  {e.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {entities.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Entities">
              {entities.map((e) => (
                <CommandItem
                  key={e.id}
                  value={`${e.label} ${e.id} entity`}
                  onSelect={() => go(routeForEntity(e))}
                >
                  {iconForEntity(e.level)}
                  {e.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
