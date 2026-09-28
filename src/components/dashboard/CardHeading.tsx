// src/components/dashboard/CardHeading.tsx

import type { LucideIcon } from "lucide-react";

interface CardHeadingProps {
  title: string;
  icon: LucideIcon;
}

// Shared title row for dashboard cards
export function CardHeading({ title, icon: Icon }: CardHeadingProps) {
  return (
    <div className="flex items-center justify-between mb-3 group">
      <h3 className="text-lg font-semibold group-hover:text-muted-foreground transition-colors duration-200">
        {title}
      </h3>
      <span className="p-1.5 rounded-md bg-leaf-soft text-leaf">
        <Icon className="w-4 h-4" />
      </span>
    </div>
  );
}
