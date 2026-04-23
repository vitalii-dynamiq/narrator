"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";

interface EntityItem {
  id: string;
  label: string;
  level: "total" | "group" | "project" | "entity";
  parent?: string;
}

function hrefFor(id: string, level: EntityItem["level"]) {
  switch (level) {
    case "total":
      return "/";
    case "group":
      return `/group/${id}`;
    case "project":
      return `/project/${id}`;
    case "entity":
      return `/entity/${id}`;
  }
}

export function HierarchyTree() {
  const { data } = useQuery({
    queryKey: ["entities-catalog"],
    queryFn: async () => {
      const res = await fetch("/api/entities");
      const j = await res.json();
      return j.entities as EntityItem[];
    },
    staleTime: 5 * 60_000,
  });
  const pathname = usePathname();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    CG_BUYOUTS: true,
    CG_GROWTH: true,
    CG_SPECSIT: true,
  });

  if (!data) {
    return (
      <div className="space-y-1 px-2 pt-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-5 w-full animate-pulse rounded-sm bg-sidebar-accent/60" />
        ))}
      </div>
    );
  }

  const byParent: Record<string, EntityItem[]> = {};
  for (const item of data) {
    if (!item.parent) continue;
    (byParent[item.parent] ??= []).push(item);
  }

  const groups = data.filter((e) => e.level === "group");

  const isActive = (href: string) => pathname === href;

  function Row({
    item,
    depth,
    hasChildren,
  }: {
    item: EntityItem;
    depth: number;
    hasChildren: boolean;
  }) {
    const open = expanded[item.id];
    const href = hrefFor(item.id, item.level);
    return (
      <li>
        <div
          className={`group flex items-center rounded-md text-[12px] transition ${
            isActive(href) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60"
          }`}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => setExpanded((s) => ({ ...s, [item.id]: !s[item.id] }))}
              className="flex h-5 w-4 items-center justify-center text-muted-foreground"
            >
              <ChevronRight
                className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`}
              />
            </button>
          ) : (
            <span className="w-4" />
          )}
          <Link href={href} className="flex-1 truncate py-1 pr-2">
            <span className="truncate">{item.label}</span>
          </Link>
        </div>
        {hasChildren && open && (
          <ul>
            {byParent[item.id]?.map((child) => (
              <Row
                key={child.id}
                item={child}
                depth={depth + 1}
                hasChildren={!!byParent[child.id]?.length}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <ul className="space-y-0.5 px-2 pt-1">
      {groups.map((g) => (
        <Row key={g.id} item={g} depth={0} hasChildren={!!byParent[g.id]?.length} />
      ))}
    </ul>
  );
}
