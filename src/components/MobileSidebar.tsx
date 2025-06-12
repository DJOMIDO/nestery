// src/components/MobileSidebar.tsx

"use client";

import { Dispatch, SetStateAction } from "react";
import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { SideBarItem } from "@/components/SideBarItem";
import { UserItem } from "@/components/UserItem";
import { useThemeToggleItem } from "@/components/ThemeToggle";
import { useCurrentUserName } from "@/lib/useCurrentUserName";
import { supabase } from "@/lib/supabaseClient";
import { LayoutDashboard, FolderKanban, Users2, Settings } from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Team", href: "/team", icon: Users2 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function MobileSidebar({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const themeToggleItem = useThemeToggleItem();
  const username = useCurrentUserName();

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => setOpen(false)}
      />

      <aside className="fixed inset-y-0 left-0 z-50 w-full max-w-xs bg-sidebar text-sidebar-foreground flex flex-col">

        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <span className="text-xl font-bold">Nestery</span>
          <button
            onClick={() => setOpen(false)}
            className="p-2 text-muted-foreground"
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-auto space-y-1 p-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <SideBarItem
                key={href}
                icon={Icon}
                label={label}
                href={href}
                collapsed={false}
                isActive={isActive}
                onClick={() => setOpen(false)}
              />
            );
          })}
        </nav>

        <div className="p-2 border-t space-y-1 border-sidebar-border">
          {themeToggleItem && (
            <SideBarItem
              icon={themeToggleItem.icon}
              label={themeToggleItem.label}
              collapsed={false}
              onClick={() => {
                themeToggleItem.onClick();
                setOpen(false);
              }}
            />
          )}
          <UserItem
            name={username || "User"}
            collapsed={false}
            onLogout={async () => {
              await supabase.auth.signOut();
              setOpen(false);
              router.push("/");
            }}
          />
        </div>
      </aside>
    </>
  );
}
