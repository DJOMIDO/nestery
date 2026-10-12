// src/components/Shortcut.tsx

"use client";

import { useIsMac } from "@/hooks/useShortcut";

// A Cmd/Ctrl shortcut shown in page text: "⌘J" on Apple devices, "Ctrl+J"
// elsewhere. Figtree has no ⌘, so the browser would borrow PingFang's thin
// one; the system font draws it at the weight of the text around it.
export function Shortcut({ k }: { k: string }) {
  const mac = useIsMac();
  return mac ? (
    <span className="whitespace-nowrap">
      <span className="font-system">⌘</span>
      {k}
    </span>
  ) : (
    <span className="whitespace-nowrap">Ctrl+{k}</span>
  );
}
