"use client";

import { create } from "zustand";
import { nanoid } from "nanoid";
import type { ChatEntry } from "./types";

// localStorage keys, namespaced under `unity.` so they don't collide with
// other apps on the same origin.
const USER_ID_KEY = "unity.userId";
const CONVERSATIONS_KEY = "unity.conversations";
const SCHEMA_VERSION_KEY = "unity.schemaVersion";
const SCHEMA_VERSION = 1;
const MAX_ENTRIES = 50;

function hasStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.getItem("__probe");
    return true;
  } catch {
    return false;
  }
}

function readVersion(): number {
  if (!hasStorage()) return 0;
  const raw = window.localStorage.getItem(SCHEMA_VERSION_KEY);
  return raw ? Number(raw) : 0;
}

function migrateIfNeeded(): void {
  if (!hasStorage()) return;
  const v = readVersion();
  if (v === SCHEMA_VERSION) return;
  // Prototype — no backwards-compat, just reset.
  if (v !== 0) {
    window.localStorage.removeItem(CONVERSATIONS_KEY);
  }
  window.localStorage.setItem(SCHEMA_VERSION_KEY, String(SCHEMA_VERSION));
}

export function ensureUserId(): string | null {
  if (!hasStorage()) return null;
  migrateIfNeeded();
  const existing = window.localStorage.getItem(USER_ID_KEY);
  if (existing) return existing;
  const id = `usr_${nanoid(10)}`;
  window.localStorage.setItem(USER_ID_KEY, id);
  return id;
}

function readEntries(): ChatEntry[] {
  if (!hasStorage()) return [];
  migrateIfNeeded();
  const raw = window.localStorage.getItem(CONVERSATIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ChatEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function writeEntries(entries: ChatEntry[]): void {
  if (!hasStorage()) return;
  window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(entries));
}

interface ChatHistoryState {
  hydrated: boolean;
  userId: string | null;
  entries: ChatEntry[];
  hydrate: () => void;
  upsert: (entry: ChatEntry) => void;
  remove: (id: string) => void;
  bumpUpdated: (id: string) => void;
}

function sortByRecency(entries: ChatEntry[]): ChatEntry[] {
  return [...entries].sort((a, b) => b.updatedAt - a.updatedAt);
}

export const useChatHistory = create<ChatHistoryState>((set, get) => ({
  hydrated: false,
  userId: null,
  entries: [],

  hydrate: () => {
    if (get().hydrated) return;
    const userId = ensureUserId();
    const entries = sortByRecency(readEntries());
    set({ userId, entries, hydrated: true });
  },

  upsert: (entry) => {
    set((state) => {
      const rest = state.entries.filter((e) => e.id !== entry.id);
      const merged = sortByRecency([entry, ...rest]).slice(0, MAX_ENTRIES);
      writeEntries(merged);
      return { entries: merged };
    });
  },

  remove: (id) => {
    set((state) => {
      const next = state.entries.filter((e) => e.id !== id);
      writeEntries(next);
      return { entries: next };
    });
  },

  bumpUpdated: (id) => {
    set((state) => {
      const idx = state.entries.findIndex((e) => e.id === id);
      if (idx === -1) return state;
      const updated = { ...state.entries[idx], updatedAt: Date.now() };
      const rest = state.entries.filter((e) => e.id !== id);
      const next = sortByRecency([updated, ...rest]);
      writeEntries(next);
      return { entries: next };
    });
  },
}));

/** Compact the first question into a sidebar-friendly title. */
export function titleFromQuestion(q: string, max = 60): string {
  const trimmed = q.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + "…";
}
