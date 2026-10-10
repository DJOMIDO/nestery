// src/components/assistant/AssistantProvider.tsx
// Opens and closes the assistant panel from anywhere in the signed-in app
// (sidebar, mobile header, Cmd/Ctrl+J).

"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";

interface AssistantContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // Mounted on first open and kept, so closing the panel keeps the chat
  const [mounted, setMounted] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return (
    <AssistantContext.Provider value={{ open, setOpen, toggle }}>
      {children}
      {mounted && <AssistantPanel open={open} onClose={() => setOpen(false)} />}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const value = useContext(AssistantContext);
  if (!value) throw new Error("useAssistant must be used inside AssistantProvider");
  return value;
}
