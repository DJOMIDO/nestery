// src/components/dashboard/ReminderCard.tsx

"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { dueReminders, type Task } from "@/lib/tasks";
import { CardHeading } from "./CardHeading";

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

// Open tasks whose reminder is due today (or already past)
export function ReminderCard({ tasks }: { tasks: Task[] }) {
  const reminders = dueReminders(tasks);
  const next = reminders[0];

  return (
    <Card className="w-full h-full rounded-lg shadow-sm bg-card hover:shadow-md">
      <CardContent className="p-4">
        <CardHeading title="Reminders" icon={Bell} />

        <div className="flex items-start space-x-4">
          <div className="flex flex-col items-center flex-shrink-0">
            <p className="text-sm font-bold text-bark">DUE</p>
            <p className="text-4xl font-extrabold leading-none">{reminders.length}</p>
          </div>

          <div className="flex-1 min-w-0">
            {next ? (
              <Link href="/tasks" className="block hover:underline">
                <p className="text-xs uppercase text-muted-foreground mb-1">
                  {formatTime(next.remindAt!)}
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
