"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { useState } from "react";
import { SidebarContent } from "./sidebar";

export function MobileDrawer() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open navigation"
        className="md:hidden h-7 w-7 rounded-md border border-border/80 bg-background flex items-center justify-center hover:border-border transition"
      >
        <Menu className="h-3.5 w-3.5 text-muted-foreground" />
      </SheetTrigger>
      <SheetContent className="w-[280px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="text-[14px] font-semibold tracking-tight">
            UNITY Narrator
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto scrollbar-thin" onClick={() => setOpen(false)}>
          <SidebarContent className="flex" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
