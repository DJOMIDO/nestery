// src/components/tasks/TaskOverviewPanel.tsx
"use client";

import { useMemo } from "react";
import { MiniCalendar } from "@/components/tasks/MiniCalendar";
import { WeekStats } from "@/components/tasks/WeekStats";
import { cn } from "@/lib/utils";
import { tagCounts, type Task } from "@/lib/tasks";

interface TaskOverviewPanelProps {
  tasks: Task[];
  dateFilter: string | null;
  onDateFilter: (date: string | null) => void;
  tagFilter: string | null;
  onTagFilter: (tag: string | null) => void;
}

// Shown on the right of the task list when no task is selected
export function TaskOverviewPanel({
  tasks,
  dateFilter,
  onDateFilter,
  tagFilter,
  onTagFilter,
}: TaskOverviewPanelProps) {
  const openTasks = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);
  const markedDates = useMemo(
    () => new Set(openTasks.flatMap((t) => (t.dueDate ? [t.dueDate] : []))),
    [openTasks]
  );
  const tags = useMemo(() => tagCounts(openTasks), [openTasks]);

  return (
    <div className="space-y-6">
      <section aria-label="Calendar">
        <MiniCalendar
          markedDates={markedDates}
          selectedDate={dateFilter}
          onSelectDate={onDateFilter}
        />
      </section>

      <section aria-label="Tags">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Tags</h3>
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add tags to your tasks to filter them here.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map(({ tag, count }) => {
              const active = tag === tagFilter;
              return (
                <button
                  key={tag}
                  onClick={() => onTagFilter(active ? null : tag)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-muted"
                  )}
                >
                  #{tag} <span className="opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section aria-label="This week">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">This week</h3>
        <WeekStats tasks={tasks} />
      </section>
    </div>
  );
}
