// src/components/dashboard/ReminderCard.tsx

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { ListChecks } from "lucide-react";
import { dueReminders, type Task } from "@/lib/tasks";

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
    <Card
      className={`
        w-full
        hover:shadow-md hover:bg-indigo-50 dark:hover:bg-gray-700
        bg-white dark:bg-gray-800
      `}
    >
      <CardContent className="p-4 flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
        <div className="flex flex-col items-center flex-shrink-0 space-y-4">
          <div className="p-2 bg-indigo-500 rounded-full">
            <ListChecks className="w-5 h-5 text-white" />
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{reminders.length}</p>
            <p className="text-xs font-medium text-indigo-500">Reminders</p>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col items-center md:items-start justify-center">
          {next ? (
            <>
              <p className="text-xs uppercase text-muted-foreground mb-1">
                {formatTime(next.remindAt!)}
              </p>
              <p className="text-base font-medium truncate max-w-full">
                {next.title}
              </p>
              {reminders.length > 1 && (
                <p className="text-xs text-muted-foreground mt-1">
                  +{reminders.length - 1} more today
                </p>
              )}
            </>
          ) : (
            <p className="text-base font-medium text-muted-foreground truncate whitespace-nowrap overflow-hidden">
              All reminders completed
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
