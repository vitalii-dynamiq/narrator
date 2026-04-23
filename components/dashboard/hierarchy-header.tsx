"use client";

import Link from "next/link";
import { ChevronRight, Sparkles, Scale, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

interface Props {
  meta: {
    id: string;
    label: string;
    level: string;
    ancestors: { id: string; label: string; level: string }[];
    children: { id: string; label: string }[];
    leafCount: number;
    metadata?: {
      industry?: string;
      geography?: string;
      currency?: string;
      baseRevenueM?: number;
      ownershipPct?: number;
      flavor?: string;
      thesis?: string;
      acquiredYear?: number;
      mandate?: string;
      aumEurM?: number;
    };
  };
  level: string;
}

function hrefFor(id: string, lvl: string) {
  switch (lvl) {
    case "total":
      return "/";
    case "group":
      return `/group/${id}`;
    case "project":
      return `/project/${id}`;
    case "entity":
      return `/entity/${id}`;
    default:
      return "/";
  }
}

export function HierarchyHeader({ meta }: Props) {
  const router = useRouter();
  return (
    <div className="space-y-3">
      <nav className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
        {meta.ancestors.map((a) => (
          <span key={a.id} className="inline-flex items-center gap-1">
            <Link href={hrefFor(a.id, a.level)} className="hover:text-foreground transition">
              {a.label}
            </Link>
            <ChevronRight className="h-3 w-3" />
          </span>
        ))}
        <span className="text-foreground font-medium">{meta.label}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[28px] font-semibold tracking-tight leading-tight">{meta.label}</h1>
            <Badge variant="secondary" className="text-[11px] font-medium capitalize h-5.5">
              {meta.level}
            </Badge>
            {meta.metadata?.industry && (
              <Badge variant="outline" className="text-[11px] font-medium h-5.5">
                {meta.metadata.industry}
              </Badge>
            )}
            {meta.metadata?.geography && (
              <Badge variant="outline" className="text-[11px] font-medium h-5.5">
                {meta.metadata.geography}
              </Badge>
            )}
          </div>
          <p className="text-[14px] text-muted-foreground max-w-2xl leading-snug">
            {meta.metadata?.flavor ?? meta.metadata?.thesis ?? meta.metadata?.mandate}
          </p>
          <div className="flex flex-wrap gap-3 text-[12.5px] text-muted-foreground pt-0.5">
            {meta.metadata?.acquiredYear && (
              <span>Acquired {meta.metadata.acquiredYear}</span>
            )}
            {meta.metadata?.ownershipPct !== undefined && (
              <span>
                {meta.metadata.ownershipPct}% owned
              </span>
            )}
            <span>
              {meta.leafCount} underlying {meta.leafCount === 1 ? "entity" : "entities"}
            </span>
            {meta.metadata?.baseRevenueM && (
              <span>LTM revenue at entry ~€{meta.metadata.baseRevenueM}M</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => router.push(`/valuation/${meta.id}`)}
          >
            <Scale className="h-3.5 w-3.5" />
            Fair Valuation Bridge
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => router.push(`/variance/${meta.id}`)}
          >
            <FileText className="h-3.5 w-3.5" />
            Variance Deep-dive
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => {
              const q = `Generate Financial Performance Commentary for ${meta.label}. Cover P&L variance vs Budget and vs Prior Year, decompose drivers, and flag any forecast divergence.`;
              router.push(`/ask?q=${encodeURIComponent(q)}`);
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate Commentary
          </Button>
        </div>
      </div>

      {meta.children && meta.children.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[11.5px] text-muted-foreground mr-1">Children:</span>
          {meta.children.map((c) => (
            <Link
              key={c.id}
              href={c.id.startsWith("PRJ_") ? `/project/${c.id}` : c.id.startsWith("CG_") ? `/group/${c.id}` : `/entity/${c.id}`}
              className="rounded-md border border-border/70 bg-background px-2 py-0.5 text-[11px] hover:border-border transition"
            >
              {c.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
