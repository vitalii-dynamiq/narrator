"use client";

import Link from "next/link";

interface LogoProps {
  /** Hide the wordmark, show only the mark. */
  compact?: boolean;
}

export function Logo({ compact }: LogoProps) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 shrink-0 group"
      aria-label="UNITY Narrator"
    >
      <LogoMark />
      {!compact && (
        <div className="hidden sm:block text-[15px] font-semibold tracking-tight leading-tight">
          UNITY <span className="text-muted-foreground font-medium">· Narrator</span>
        </div>
      )}
    </Link>
  );
}

/**
 * Neutral cube-cell mark — a 3×3 grid of cells with one highlighted.
 * Directly represents the product's core metaphor: inspecting a single cell
 * in the firm's reporting cube. No firm-specific motifs.
 */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 transition-transform group-hover:scale-[1.04]"
      aria-hidden
    >
      {/* Dark tile */}
      <rect width="32" height="32" rx="7" className="fill-foreground" />
      {/* Eight muted cells */}
      <g className="fill-muted-foreground/40">
        <rect x="6" y="6" width="6" height="6" rx="1" />
        <rect x="13" y="6" width="6" height="6" rx="1" />
        <rect x="20" y="6" width="6" height="6" rx="1" />
        <rect x="6" y="13" width="6" height="6" rx="1" />
        <rect x="20" y="13" width="6" height="6" rx="1" />
        <rect x="6" y="20" width="6" height="6" rx="1" />
        <rect x="13" y="20" width="6" height="6" rx="1" />
        <rect x="20" y="20" width="6" height="6" rx="1" />
      </g>
      {/* Highlighted selected cell */}
      <rect x="13" y="13" width="6" height="6" rx="1" className="fill-amber-400" />
    </svg>
  );
}
