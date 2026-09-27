// src/components/dashboard/RecentActivityCard.tsx

"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, CheckCircle2, ClipboardList } from "lucide-react";
import { formatRelative, taskActivity, type Task } from "@/lib/tasks";

// Recently created and completed tasks
export function RecentActivityCard({ tasks }: { tasks: Task[] }) {
  const activities = taskActivity(tasks);

  return (
    <Card className="w-full h-full shadow-sm bg-white dark:bg-gray-800 hover:shadow-md">
      <CardContent className="p-4 flex flex-col min-h-0 flex-1">
        <div className="flex items-center justify-between mb-3 group">
          <h3 className="text-lg font-semibold group-hover:text-muted-foreground transition-colors duration-200">Recent Activity</h3>
          <Activity className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors duration-200" />
        </div>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="space-y-0.5 min-h-0 overflow-y-auto">
            {activities.map(({ id, kind, title, at }) => {
              const Icon = kind === "completed" ? CheckCircle2 : ClipboardList;
              return (
                <li
                  key={id}
                  className="flex justify-between items-start p-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-l-4 border-transparent hover:border-indigo-500"
                >
                  <Link
                    href="/tasks"
                    className="flex items-center space-x-2 flex-1 min-w-0 hover:text-primary hover:underline"
                  >
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        kind === "completed" ? "text-lime-600" : "text-indigo-600"
                      }`}
                    />
                    <span
                      className="inline-block bg-indigo-100 text-indigo-600 dark:bg-indigo-200
                   px-2 py-1 rounded text-sm font-medium truncate whitespace-nowrap overflow-hidden"
                    >
                      {kind === "completed" ? "Completed" : "Created"} &apos;{title}&apos;
                    </span>
                  </Link>
                  <span className="pl-2 text-xs text-muted-foreground whitespace-nowrap">
                    {formatRelative(at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
