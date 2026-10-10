// app/components/Sidebar.tsx

"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

import { SideBarItem } from "@/components/SideBarItem";
import { useAssistant } from "@/components/assistant/AssistantProvider";
import { NesteryMark } from "@/components/brand/NatureShapes";
import { UserItem } from "@/components/UserItem";
import { navItems } from "@/components/nav";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { signOut } from "@/lib/auth-client";
import { useCurrentUserName } from "@/lib/useCurrentUserName";

export function Sidebar({ className = "" }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { collapsed, isReady, toggle } = useSidebarCollapsed();
  const username = useCurrentUserName();
  const assistant = useAssistant();

  // Cmd/Ctrl+\ toggles the sidebar (Cmd/Ctrl+B is bold in the note editor)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "\\" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  if (!isReady) return null;

  return (
    <aside
      // Raised above the page so the edge handle can overlap the content
      className={`group/sidebar relative z-20 hidden md:flex h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border
        flex-col justify-between transition-all duration-300
        ${collapsed ? "w-16" : "w-48"} ${className}`}
    >
      <div>
        {/* Brand: the mark keeps the same spot whether collapsed or not */}
        <div className="flex h-18 items-center gap-2.5 px-4">
          <NesteryMark className="size-8 shrink-0" />
          {!collapsed && <span className="text-xl font-bold tracking-tight">Nestery</span>}
        </div>

        {/* Edge handle on the border, shown while hovering the sidebar */}
        <button
          onClick={toggle}
          className="absolute -right-3 top-18 flex size-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm
            opacity-0 transition-opacity hover:text-foreground group-hover/sidebar:opacity-100 focus-visible:opacity-100"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={`${collapsed ? "Expand" : "Collapse"} sidebar (⌘\\)`}
        >
          {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
        </button>

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
        <SideBarItem icon={Sparkles} label="Assistant (⌘J)" onClick={assistant.toggle} collapsed={collapsed} />
        <UserItem
          name={username || "User"}
          collapsed={collapsed}
          onLogout={async () => {
            await signOut();
            router.push("/");
          }}
        />
      </div>
    </aside>
  );
}
