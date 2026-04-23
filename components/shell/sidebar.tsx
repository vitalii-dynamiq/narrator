"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  GitBranch,
  Scale,
  Database,
  Sparkles,
} from "lucide-react";
import { HierarchyTree } from "./hierarchy-tree";

const NAV = [
  { href: "/ask", label: "Ask UNITY", icon: Sparkles },
  { href: "/", label: "Portfolio", icon: LayoutGrid },
  { href: "/variance/PORTFOLIO_TOTAL", label: "Variance", icon: GitBranch },
  { href: "/valuation/PORTFOLIO_TOTAL", label: "Valuation", icon: Scale },
  { href: "/model", label: "Data Model", icon: Database },
] as const;

export function SidebarContent({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  return (
    <div className={`flex-col ${className}`}>
      <nav className="px-3 pt-3">
        <div className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
          Workspace
        </div>
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] transition ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-4 border-t border-border/70 pt-3">
        <div className="px-5 pb-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Portfolio structure
          </div>
          <div className="text-[11px] text-muted-foreground/80 mt-0.5">
            3 groups · 13 projects · 30 entities
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-1 pb-3">
        <HierarchyTree />
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-[52px] hidden h-[calc(100vh-52px)] w-[256px] shrink-0 border-r border-border/80 bg-sidebar md:flex">
      <SidebarContent className="flex w-full" />
    </aside>
  );
}
