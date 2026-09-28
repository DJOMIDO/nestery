// src/components/nav.ts
// Sidebar navigation shared by the desktop and mobile sidebars.

import { LayoutDashboard, ListTodo, NotebookPen } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Tasks", href: "/tasks", icon: ListTodo },
  { label: "Notes", href: "/notes", icon: NotebookPen },
];
