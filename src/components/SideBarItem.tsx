// app/components/SideBarItem.tsx

"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";

type SideBarItemProps =
  | {
      icon: LucideIcon;
      label: string;
      href: string;
      collapsed: boolean;
      isActive?: boolean;
      onClick?: () => void;
    }
  | {
      icon: LucideIcon;
      label: string;
      onClick: () => void;
      collapsed: boolean;
    };

export function SideBarItem(props: SideBarItemProps) {
  const { icon: Icon, label, collapsed } = props;

  const content = (
    <>
      <div className="w-8 h-8 flex items-center justify-center rounded-full">
        <Icon className="w-5 h-5 shrink-0" />
      </div>
      {!collapsed && <span className="truncate">{label}</span>}
    </>
  );

  const inner =
    "href" in props ? (
      <Link
        href={props.href}
        onClick={props.onClick}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
          props.isActive
            ? "bg-primary/10 text-primary dark:bg-primary/20"
            : "text-muted-foreground",
          collapsed ? "justify-center" : "justify-start"
        )}
      >
        {content}
      </Link>
    ) : (
      <button
        onClick={props.onClick}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted w-full text-muted-foreground",
          collapsed ? "justify-center" : "justify-start"
        )}
      >
        {content}
      </button>
    );

  return collapsed ? (
    <Tooltip.Provider delayDuration={400}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{inner}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="right"
            className="bg-muted text-foreground px-2 py-1 text-xs rounded shadow-md z-50"
          >
            {label}
            <Tooltip.Arrow className="fill-muted" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  ) : (
    inner
  );
}
