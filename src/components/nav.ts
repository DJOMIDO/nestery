// src/components/nav.ts
// Sidebar navigation shared by the desktop and mobile sidebars.

import { CalendarDays, LayoutDashboard, ListTodo, NotebookPen, Plane } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  // Its label in messages (nav.<key>)
  key: "dashboard" | "tasks" | "notes" | "calendar" | "travel";
  href: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "tasks", href: "/tasks", icon: ListTodo },
  { key: "notes", href: "/notes", icon: NotebookPen },
  { key: "calendar", href: "/calendar", icon: CalendarDays },
  { key: "travel", href: "/travel", icon: Plane },
];
