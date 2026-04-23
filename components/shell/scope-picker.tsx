"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EntityItem {
  id: string;
  label: string;
  level: "total" | "group" | "project" | "entity";
  parent?: string;
}

const LEVEL_LABEL: Record<EntityItem["level"], string> = {
  total: "Portfolio",
  group: "Consolidated groups",
  project: "Projects",
  entity: "Entities",
};

export function ScopePicker({
  value,
  basePath,
}: {
  value: string;
  basePath: "/variance" | "/valuation";
}) {
  const router = useRouter();
  const { data } = useQuery({
    queryKey: ["entities-catalog"],
    queryFn: async () => {
      const r = await fetch("/api/entities");
      const j = await r.json();
      return j.entities as EntityItem[];
    },
    staleTime: 5 * 60_000,
  });

  const grouped: Record<EntityItem["level"], EntityItem[]> = {
    total: [],
    group: [],
    project: [],
    entity: [],
  };
  for (const e of data ?? []) grouped[e.level].push(e);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
        Scope
      </span>
      <Select
        value={value}
        onValueChange={(v) => {
          if (!v || v === value) return;
          router.push(`${basePath}/${v}`);
        }}
      >
        <SelectTrigger className="h-8 min-w-[240px] text-[13px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[420px]">
          {(["total", "group", "project", "entity"] as const).map((lvl, i) => {
            const items = grouped[lvl];
            if (items.length === 0) return null;
            return (
              <SelectGroup key={lvl}>
                {i > 0 && <SelectSeparator />}
                <SelectLabel className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground font-medium">
                  {LEVEL_LABEL[lvl]}
                </SelectLabel>
                {items.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
