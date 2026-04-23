"use client";

import { useEffect, useState } from "react";
import { MobileDrawer } from "./mobile-drawer";
import { Logo } from "./logo";
import { CommandPalette } from "./command-palette";

export function TopBar() {
  const [paletteOpen, setPaletteOpen] = useState(false);

  // ⌘K / Ctrl+K still opens the command palette for power users; no visible button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 h-[52px] border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="flex h-full items-center gap-2 md:gap-4 pl-3 pr-3 md:pl-4 md:pr-4">
        <MobileDrawer />
        <Logo />
        <div className="flex-1" />
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
