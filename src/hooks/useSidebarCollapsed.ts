// src/hooks/useSidebarCollapsed.ts

import { useCallback, useEffect, useState } from "react";

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    setCollapsed(stored === "true");
  }, []);

  // Stable, so listeners (e.g. the keyboard shortcut) do not re-subscribe each render
  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const newValue = !prev;
      localStorage.setItem("sidebar-collapsed", JSON.stringify(newValue));
      return newValue;
    });
  }, []);

  return {
    collapsed: collapsed ?? false, // fallback
    isReady: collapsed !== null,
    toggle,
  };
}
