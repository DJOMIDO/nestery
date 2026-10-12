// app/components/UserItem.tsx

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { ChevronsUpDown, LogOut, Monitor, Moon, Settings, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { UserAvatar } from "@/components/UserAvatar";
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

// Labels in messages (nav.<label>)
const themeOptions = [
  { value: "light", label: "themeLight", icon: Sun },
  { value: "dark", label: "themeDark", icon: Moon },
  { value: "system", label: "themeSystem", icon: Monitor },
] as const;

interface UserItemProps {
  collapsed: boolean;
  name: string;
  onLogout: () => void;
}

// Sidebar user button; opens a menu with account actions
export function UserItem({ collapsed, name, onLogout }: UserItemProps) {
  const t = useTranslations("nav");
  const { theme = "system", setTheme } = useTheme();
  // Settings lives in this menu, so highlight the trigger while on that page
  const isSettings = usePathname().startsWith("/settings");
  const image = authClient.useSession().data?.user.image;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition hover:bg-muted data-[state=open]:bg-muted text-muted-foreground w-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
          collapsed ? "justify-center px-0" : "justify-start",
          isSettings && "bg-muted text-foreground"
        )}
        aria-label={t("accountMenu")}
      >
        <UserAvatar name={name} image={image} className="size-8 text-sm" />

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
            {t("settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Theme; "System" follows the OS light/dark setting */}
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {t("theme")}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          {themeOptions.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon />
              {t(label)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout}>
          <LogOut />
          {t("logOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
