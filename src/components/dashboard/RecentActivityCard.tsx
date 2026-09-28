// src/components/dashboard/RecentActivityCard.tsx

"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { CardHeading } from "./CardHeading";
import { Activity, CheckCircle2, ClipboardList } from "lucide-react";
import { formatRelative, taskActivity, type Task } from "@/lib/tasks";

// Recently created and completed tasks
export function RecentActivityCard({ tasks }: { tasks: Task[] }) {
  const activities = taskActivity(tasks);

  return (
    <Card className="w-full h-full rounded-lg shadow-sm bg-card hover:shadow-md">
      <CardContent className="p-4 flex flex-col min-h-0 flex-1">
        <CardHeading title="Recent Activity" icon={Activity} />
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ul className="space-y-0.5 min-h-0 overflow-y-auto">
            {activities.map(({ id, kind, title, at }) => {
              const Icon = kind === "completed" ? CheckCircle2 : ClipboardList;
              return (
                <li
                  key={id}
                  className="flex justify-between items-start p-2 hover:bg-muted border-l-4 border-transparent hover:border-leaf"
                >
                  <Link
                    href="/tasks"
                    className="flex items-center space-x-2 flex-1 min-w-0 hover:text-primary hover:underline"
                  >
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        kind === "completed" ? "text-leaf" : "text-bark"
                      }`}
                    />
                    <span
                      className="inline-block bg-leaf-soft text-leaf
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
