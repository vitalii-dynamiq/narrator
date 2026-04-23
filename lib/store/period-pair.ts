"use client";

import { create } from "zustand";
import type { VersionId } from "@/lib/jedox/schema";
import { VERSIONS } from "@/lib/jedox/schema";
import { DEMO_CURRENT_PERIOD } from "@/lib/jedox/time";

export interface PeriodVersionPair {
  period: string; // YYYY-MM, YYYY-QN, YTD-YYYY-MM, or YYYY
  version: VersionId;
  label: string; // short label like "Mar 2026 · Actual"
}

interface PeriodPairStore {
  a: PeriodVersionPair;
  b: PeriodVersionPair;
  setA: (p: PeriodVersionPair) => void;
  setB: (p: PeriodVersionPair) => void;
  swap: () => void;
}

export const usePeriodPair = create<PeriodPairStore>((set) => ({
  a: {
    period: DEMO_CURRENT_PERIOD,
    version: VERSIONS.Actual,
    label: "Mar 2026 · Actual",
  },
  b: {
    period: DEMO_CURRENT_PERIOD,
    version: VERSIONS.Budget2026,
    label: "Mar 2026 · Budget",
  },
  setA: (p) => set({ a: p }),
  setB: (p) => set({ b: p }),
  swap: () =>
    set((s) => ({
      a: s.b,
      b: s.a,
    })),
}));
