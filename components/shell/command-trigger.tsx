"use client";

import { useEffect, useState } from "react";
import { CommandPalette } from "./command-palette";

export function CommandTrigger() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-border/80 bg-background px-2 py-1 text-[11px] text-muted-foreground hover:border-border transition"
        aria-label="Open command palette"
      >
        <span>Search</span>
        <kbd className="rounded bg-muted px-1 py-px text-[9.5px] font-mono font-medium">⌘K</kbd>
      </button>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}
