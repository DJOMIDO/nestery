"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Users2,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { useThemeToggleItem } from "@/components/ThemeToggle";
import { SideBarItem } from "@/components/SideBarItem";
import { UserItem } from "@/components/UserItem";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Team", href: "/team", icon: Users2 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, isReady, toggle } = useSidebarCollapsed();
  const themeToggleItem = useThemeToggleItem();
  const mockUserName = "John Doe";

  if (!isReady) return null;

  return (
    <aside
      className={`h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col justify-between transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div>
        <div
          className={`flex items-center px-4 py-4 transition-all ${
            collapsed ? "justify-center" : "justify-between"
          }`}
        >
          {!collapsed && <span className="text-lg font-bold">Nestery</span>}
          <button
            onClick={toggle}
            className="text-muted-foreground text-sm"
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </button>
        </div>

        <nav className="mt-2 space-y-1 px-2">
          {navItems.map(({ href, label, icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <SideBarItem
                key={href}
                icon={icon}
                label={label}
                href={href}
                collapsed={collapsed}
                isActive={isActive}
              />
            );
          })}
        </nav>
      </div>

      <div className="px-2 pb-6 space-y-3">
        {themeToggleItem && (
          <SideBarItem
            icon={themeToggleItem.icon}
            label={themeToggleItem.label}
            collapsed={collapsed}
            onClick={themeToggleItem.onClick}
          />
        )}

        <UserItem
          name={mockUserName}
          collapsed={collapsed}
          onLogout={() => alert("Logged out")}
        />
      </div>
    </aside>
  );
}
