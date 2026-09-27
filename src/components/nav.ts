// src/components/nav.ts
// Sidebar navigation shared by the desktop and mobile sidebars.

import { LayoutDashboard, ListTodo, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Settings", href: "/settings", icon: Settings },
];
