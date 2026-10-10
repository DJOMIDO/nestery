// src/components/dashboard/CardHeading.tsx

import type { LucideIcon } from "lucide-react";

interface CardHeadingProps {
  title: string;
  icon: LucideIcon;
  // Shown next to the icon, e.g. the Today card's weather. Cards wrap the
  // heading in a link, so keep it non-interactive.
  aside?: React.ReactNode;
}

// Shared title row for dashboard cards
export function CardHeading({ title, icon: Icon, aside }: CardHeadingProps) {
  return (
    <div className="flex items-center justify-between gap-2 mb-3 group">
      <h3 className="text-lg font-semibold group-hover:text-muted-foreground transition-colors duration-200">
        {title}
      </h3>
      <div className="flex min-w-0 items-center gap-2">
        {aside}
        <span className="p-1.5 rounded-md bg-leaf-soft text-leaf">
          <Icon className="w-4 h-4" />
        </span>
      </div>
    </div>
  );
}
