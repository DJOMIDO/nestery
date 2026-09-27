// src/components/dashboard/WeekCard.tsx
"use client";

import { CalendarRange } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { WeekStats } from "@/components/tasks/WeekStats";
import type { Task } from "@/lib/tasks";

export function WeekCard({ tasks }: { tasks: Task[] }) {
  return (
    <Card className="w-full shadow-sm bg-white dark:bg-gray-800 hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4 group">
          <h3 className="text-lg font-semibold group-hover:text-muted-foreground transition-colors duration-200">
            This Week
          </h3>
          <CalendarRange className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors duration-200" />
        </div>
        <WeekStats tasks={tasks} />
      </CardContent>
    </Card>
  );
}
