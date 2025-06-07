"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export function useThemeToggleItem() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = theme === "dark";

  return {
    label: isDark ? "Light Mode" : "Dark Mode",
    icon: isDark ? Sun : Moon,
    onClick: () => setTheme(isDark ? "light" : "dark"),
  };
}
