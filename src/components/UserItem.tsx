// app/components/UserItem.tsx

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { ChevronsUpDown, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

interface UserItemProps {
  collapsed: boolean;
  name: string;
  onLogout: () => void;
}

// Sidebar user button; opens a menu with account actions
export function UserItem({ collapsed, name, onLogout }: UserItemProps) {
  const { theme = "system", setTheme } = useTheme();
  // Settings lives in this menu, so highlight the trigger while on that page
  const isSettings = usePathname().startsWith("/settings");

  const getInitials = (fullName: string) => {
    const parts = fullName.trim().split(" ").filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return parts[0][0].toUpperCase() + parts[1][0].toUpperCase();
  };

  const initials = getInitials(name);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition hover:bg-muted data-[state=open]:bg-muted text-muted-foreground w-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
          collapsed ? "justify-center px-0" : "justify-start",
          isSettings && "bg-muted text-foreground"
        )}
        aria-label="Account menu"
      >
        <div className="w-8 h-8 rounded-full bg-forest text-white font-bold flex items-center justify-center text-sm shrink-0">
          {initials}
        </div>

        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left">{name}</span>
            <ChevronsUpDown className="w-4 h-4 shrink-0" />
          </>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side={collapsed ? "right" : "top"}
        align={collapsed ? "end" : "start"}
        className={collapsed ? "w-48" : "w-(--radix-dropdown-menu-trigger-width)"}
      >
        <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Theme; "System" follows the OS light/dark setting */}
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout}>
          <LogOut />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
