// src/components/MobileHeader.tsx

"use client";

import { useState } from "react";
import { Menu as MenuIcon } from "lucide-react";
import { MobileSidebar } from "./MobileSidebar";

export function MobileHeader() {
  const [open, setOpen] = useState(false);

  return (
    <>

      <header className="flex items-center justify-between md:hidden bg-sidebar text-sidebar-foreground px-4 py-2 border-b border-sidebar-border">
        <span className="text-lg font-bold">Nestery</span>
        <button
          onClick={() => setOpen(true)}
          className="p-2 text-muted-foreground"
          aria-label="Open menu"
        >
          <MenuIcon className="w-6 h-6" />
        </button>
      </header>

      <MobileSidebar open={open} setOpen={setOpen} />
    </>
  );
}
