// src/components/dashboard/DeadlinesCard.tsx
"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toDateKey, upcomingDeadlines, type Task } from "@/lib/tasks";

const MAX_ITEMS = 5;

const formatDate = (dateKey: string) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

// Open tasks that are overdue or due within the next 7 days
export function DeadlinesCard({ tasks }: { tasks: Task[] }) {
  const today = toDateKey(new Date());
  const deadlines = upcomingDeadlines(tasks, 7, today).slice(0, MAX_ITEMS);

  return (
    <Card className="w-full shadow-sm bg-white dark:bg-gray-800 hover:shadow-md">
      <CardContent className="p-4">

        <div className="flex items-center justify-between group">
          <h3 className="text-lg font-semibold group-hover:text-muted-foreground transition-colors duration-200">Deadlines</h3>
          <Clock className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors duration-200" />
        </div>

        {deadlines.length === 0 && (
          <p className="text-sm text-muted-foreground py-3">
            Nothing due in the next 7 days.
          </p>
        )}

        <div className="space-y-0.5">
          {deadlines.map(({ id, title, dueDate }) => {
            const status = dueDate! < today ? "overdue" : "upcoming";
            return (
              <Link
                key={id}
                href="/tasks"
                className={`
                  flex items-center justify-between p-3 rounded-md
                  hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                `}
              >

                <div
                  className={`
                    w-1 h-8 mr-3 rounded
                    ${status === "overdue" ? "bg-rose-500" : "bg-lime-500"}
                  `}
                />

                <div className="flex-1 min-w-0">
                  <span
                    className={`
                      inline-block max-w-full truncate px-2 py-1 rounded text-sm font-medium
                      ${
                        status === "overdue"
                          ? "bg-red-100 text-rose-600"
                          : "bg-lime-100 text-lime-600"
                      }
                    `}
                  >
                    {title}
                  </span>
                </div>

                <div className="flex items-center pl-2 space-x-2 whitespace-nowrap">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(dueDate!)}
                  </span>
                  <Badge
                    variant={status === "overdue" ? "destructive" : "outline"}
                    className="text-xs"
                  >
                    {status === "overdue" ? "Overdue" : dueDate === today ? "Today" : "Upcoming"}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
