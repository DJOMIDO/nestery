// src/components/dashboard/ReminderCard.tsx

"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, type LucideIcon } from "lucide-react";
import { dueReminders, type Task } from "@/lib/tasks";
import { journeyReminderAt, journeyRoute, journeyTimes, type Journey } from "@/lib/travel";
import { journeyIcon } from "@/components/travel/journeyIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { CardHeading } from "./CardHeading";
import { useFormat } from "@/components/SettingsProvider";

interface DueReminder {
  key: string;
  title: string;
  at: Date;
  href: string;
  // e.g. "Departs 5:40 PM"
  detail?: string;
  // A journey's plane or train
  icon?: LucideIcon;
}

// Open tasks whose reminder is due today (or already past), and journeys
// whose reminder is due today and which haven't left yet
export function ReminderCard({
  tasks,
  journeys,
  loading,
}: {
  tasks: Task[];
  journeys: Journey[];
  // Tasks and journeys still on their way
  loading?: boolean;
}) {
  const format = useFormat();
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const reminders: DueReminder[] = [
    ...dueReminders(tasks, now).map((t) => ({
      key: `task-${t.id}`,
      title: t.title,
      at: new Date(t.remindAt!),
      href: `/tasks?task=${t.id}`,
    })),
    ...journeys.flatMap((j) => {
      const at = journeyReminderAt(j);
      const departs = journeyTimes(j)?.start;
      if (!at || !departs || at > endOfToday || departs <= now) return [];
      return [
        {
          key: `journey-${j.id}`,
          title: journeyRoute(j),
          icon: journeyIcon(j.kind),
          at,
          href: `/travel?journey=${j.id}`,
          detail: `Departs ${format.time(departs)}`,
        },
      ];
    }),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const next = reminders[0];

  return (
    <Card className="w-full h-full rounded-lg bg-card">
      <CardContent className="p-4">
        <CardHeading title="Reminders" icon={Bell} />

        <div className="flex items-start space-x-4">
          <div className="flex flex-col items-center flex-shrink-0">
            <p className="text-sm font-bold text-bark">DUE</p>
            {loading ? (
              <Skeleton className="appear-late mt-1 h-8 w-6" />
            ) : (
              <p className="text-4xl font-extrabold leading-none">{reminders.length}</p>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {loading ? (
              <div role="status" aria-label="Loading reminders" className="appear-late space-y-2 pt-0.5">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-7 w-3/4" />
              </div>
            ) : next ? (
              <Link href={next.href} className="block hover:underline">
                <p className="text-xs uppercase text-muted-foreground mb-1">
                  {format.dayTime(next.at)}
                  {next.detail && ` · ${next.detail}`}
                </p>
                <p className="inline-flex max-w-full items-center gap-1.5 text-leaf bg-leaf-soft px-2 py-1 rounded text-sm font-medium">
                  {next.icon && <next.icon className="size-3.5 shrink-0" />}
                  <span className="truncate">{next.title}</span>
                </p>
                {reminders.length > 1 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    +{reminders.length - 1} more today
                  </p>
                )}
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">All reminders completed.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
