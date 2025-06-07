// src/hooks/useSidebarCollapsed.ts
import { useEffect, useState } from "react";

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    setCollapsed(stored === "true");
  }, []);

  const toggle = () => {
    setCollapsed(prev => {
      const newValue = !prev;
      localStorage.setItem("sidebar-collapsed", JSON.stringify(newValue));
      return newValue;
    });
  };

  return {
    collapsed: collapsed ?? false, // fallback
    isReady: collapsed !== null,
    toggle,
  };
}
