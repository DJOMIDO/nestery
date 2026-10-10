// src/components/dashboard/ReminderCard.tsx

"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { dueReminders, type Task } from "@/lib/tasks";
import { journeyReminderAt, journeyTimes, journeyTitle, type Journey } from "@/lib/travel";
import { CardHeading } from "./CardHeading";
import { useFormat } from "@/components/SettingsProvider";

interface DueReminder {
  key: string;
  title: string;
  at: Date;
  href: string;
  // e.g. "Departs 5:40 PM"
  detail?: string;
}

// Open tasks whose reminder is due today (or already past), and journeys
// whose reminder is due today and which haven't left yet
export function ReminderCard({ tasks, journeys }: { tasks: Task[]; journeys: Journey[] }) {
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
          title: journeyTitle(j),
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
            <p className="text-4xl font-extrabold leading-none">{reminders.length}</p>
          </div>

          <div className="flex-1 min-w-0">
            {next ? (
              <Link href={next.href} className="block hover:underline">
                <p className="text-xs uppercase text-muted-foreground mb-1">
                  {format.dayTime(next.at)}
                  {next.detail && ` · ${next.detail}`}
                </p>
                <p className="inline-block max-w-full truncate text-leaf bg-leaf-soft px-2 py-1 rounded text-sm font-medium">
                  {next.title}
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
