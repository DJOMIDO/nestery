// src/components/tasks/TaskOverviewPanel.tsx
"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { MiniCalendar } from "@/components/tasks/MiniCalendar";
import { WeekStats } from "@/components/tasks/WeekStats";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { tagCounts, type Task } from "@/lib/tasks";

interface TaskOverviewPanelProps {
  tasks: Task[];
  dateFilter: string | null;
  onDateFilter: (date: string | null) => void;
  tagFilter: string | null;
  onTagFilter: (tag: string | null) => void;
  // Tasks still on their way: placeholders instead of the empty-state hint and zeros
  loading?: boolean;
}

// Shown on the right of the task list when no task is selected
export function TaskOverviewPanel({
  tasks,
  dateFilter,
  onDateFilter,
  tagFilter,
  onTagFilter,
  loading,
}: TaskOverviewPanelProps) {
  const t = useTranslations("tasks.overviewPanel");
  const openTasks = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);
  const markedDates = useMemo(
    () => new Set(openTasks.flatMap((t) => (t.dueDate ? [t.dueDate] : []))),
    [openTasks]
  );
  const tags = useMemo(() => tagCounts(openTasks), [openTasks]);

  return (
    <div className="flex flex-col h-full gap-6">
      <section aria-label={t("calendar")}>
        <MiniCalendar
          markedDates={markedDates}
          selectedDate={dateFilter}
          onSelectDate={onDateFilter}
        />
      </section>

      <section aria-label={t("tags")}>
        <h3 className="mb-3 text-base font-semibold text-muted-foreground">{t("tags")}</h3>
        {loading ? (
          <div role="status" aria-label={t("loadingTags")} className="appear-late flex flex-wrap gap-2">
            {["w-16", "w-20", "w-14"].map((w) => (
              <Skeleton key={w} className={`h-6 rounded-full ${w}`} />
            ))}
          </div>
        ) : tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("tagsEmpty")}
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

      {/* Pinned to the bottom of the panel */}
      <section aria-label={t("thisWeek")} className="mt-auto">
        <h3 className="mb-3 text-base font-semibold text-muted-foreground">{t("thisWeek")}</h3>
        <WeekStats tasks={tasks} loading={loading} />
      </section>
    </div>
  );
}
