// src/components/MobileHeader.tsx

"use client";

import { useState } from "react";
import { Menu as MenuIcon, Sparkles } from "lucide-react";
import { useAssistant } from "@/components/assistant/AssistantProvider";
import { MobileSidebar } from "./MobileSidebar";
import { NesteryMark } from "@/components/brand/NatureShapes";

export function MobileHeader() {
  const [open, setOpen] = useState(false);
  const assistant = useAssistant();

  return (
    <>

      <header className="flex items-center justify-between md:hidden bg-sidebar text-sidebar-foreground px-4 py-2 border-b border-sidebar-border">
        <span className="flex items-center gap-2">
          <NesteryMark className="size-6" />
          <span className="text-xl font-bold">Nestery</span>
        </span>
        <span className="flex items-center">
          <button onClick={assistant.toggle} className="p-2 text-muted-foreground" aria-label="Open assistant">
            <Sparkles className="w-5 h-5" />
          </button>
          <button
            onClick={() => setOpen(true)}
            className="p-2 text-muted-foreground"
            aria-label="Open menu"
          >
            <MenuIcon className="w-6 h-6" />
          </button>
        </span>
      </header>

      <MobileSidebar open={open} setOpen={setOpen} />
    </>
  );
}
