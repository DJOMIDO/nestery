// app/components/UserItem.tsx

"use client";

import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface UserItemProps {
  collapsed: boolean;
  name: string;
  onLogout: () => void;
}

export function UserItem({ collapsed, name, onLogout }: UserItemProps) {
  const [showLogout, setShowLogout] = useState(false);

  const getInitials = (fullName: string) => {
    const parts = fullName.trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return parts[0][0].toUpperCase() + parts[1][0].toUpperCase();
  };

  const initials = getInitials(name);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition hover:bg-muted text-muted-foreground w-full",
        collapsed ? "justify-center px-0" : "justify-start"
      )}
    >
      <div className="w-8 h-8 rounded-full bg-indigo-300 text-white font-bold flex items-center justify-center text-sm shrink-0">
        {initials}
      </div>

      {!collapsed && (
        <span
          className="flex-1 cursor-pointer"
          onClick={() => setShowLogout((prev) => !prev)}
        >
          {name}
        </span>
      )}

      {!collapsed && (
        <button
          onClick={onLogout}
          className={cn(
            "py-2 rounded transition-opacity duration-200",
            showLogout ? "opacity-100" : "opacity-0"
          )}
          aria-label="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
