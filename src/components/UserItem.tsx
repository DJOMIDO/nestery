"use client";

import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserItemProps {
  collapsed: boolean;
  name: string;
  onLogout: () => void;
}

export function UserItem({ collapsed, name, onLogout }: UserItemProps) {
  const getInitials = (fullName: string) => {
    const parts = fullName.trim().split(" ");
    return parts
      .map((p) => p[0]?.toUpperCase())
      .join("")
      .slice(0, 2);
  };

  const initials = getInitials(name);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md py-2 text-sm font-medium transition hover:bg-muted text-muted-foreground w-full",
        collapsed ? "justify-center px-0" : "justify-start px-3"
      )}
    >
      <div className="w-8 h-8 rounded-full bg-blue-500 text-foreground font-bold flex items-center justify-center text-sm shrink-0">
        {initials}
      </div>

      {!collapsed && <span className="flex-1 truncate">{name}</span>}

      {!collapsed && (
        <button
          onClick={onLogout}
          className="text-muted-foreground hover:text-foreground transition"
          aria-label="Logout"
        >
          <LogOut className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
