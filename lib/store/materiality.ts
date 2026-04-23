"use client";

import { create } from "zustand";

interface MaterialityStore {
  thresholdEur: number; // minimum absolute delta to show
  thresholdPct: number; // minimum pct delta to show (0..1)
  set: (eur: number, pct?: number) => void;
}

// Default: €500k / 3% — mid-point between entity-level and project-level defaults
export const useMateriality = create<MaterialityStore>((set) => ({
  thresholdEur: 500_000,
  thresholdPct: 0.03,
  set: (eur, pct) => set({ thresholdEur: eur, thresholdPct: pct ?? 0.03 }),
}));
