// src/components/dashboard/DeadlinesCard.tsx
"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { CardHeading } from "./CardHeading";
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
    <Card className="w-full h-full rounded-lg shadow-sm bg-card hover:shadow-md">
      <CardContent className="p-4 flex-1 min-h-0 overflow-y-auto">

        <CardHeading title="Deadlines" icon={Clock} />

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
                  hover:bg-muted transition-colors
                `}
              >

                <div
                  className={`
                    w-1 h-8 mr-3 rounded
                    ${status === "overdue" ? "bg-rose-500" : "bg-leaf"}
                  `}
                />

                <div className="flex-1 min-w-0">
                  <span
                    className={`
                      inline-block max-w-full truncate px-2 py-1 rounded text-sm font-medium
                      ${
                        status === "overdue"
                          ? "bg-red-100 text-rose-600"
                          : "bg-leaf-soft text-leaf"
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
