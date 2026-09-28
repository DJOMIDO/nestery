// src/components/tasks/WeekStats.tsx
"use client";

import { weekStats, type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { useFormat } from "@/components/SettingsProvider";

// Four small tiles summarizing the current week (from the configured week start)
export function WeekStats({ tasks }: { tasks: Task[] }) {
  const { weekStart } = useFormat();
  const stats = weekStats(tasks, undefined, weekStart);
  const tiles = [
    { label: "Done this week", value: stats.completed, className: "text-leaf" },
    { label: "Due this week", value: stats.dueThisWeek, className: "text-bark" },
    { label: "Overdue", value: stats.overdue, className: stats.overdue ? "text-rose-600" : "" },
    { label: "Open", value: stats.open, className: "" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map(({ label, value, className }) => (
        <div key={label} className="rounded-md border p-3">
          <p className={cn("text-2xl font-bold", className)}>{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}
