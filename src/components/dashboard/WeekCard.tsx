// src/components/dashboard/WeekCard.tsx
"use client";

import { CalendarRange } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CardHeading } from "./CardHeading";
import { WeekStats } from "@/components/tasks/WeekStats";
import type { Task } from "@/lib/tasks";

export function WeekCard({ tasks }: { tasks: Task[] }) {
  return (
    <Card className="w-full h-full rounded-lg shadow-sm bg-card hover:shadow-md">
      <CardContent className="p-4 flex-1 min-h-0 overflow-y-auto">
        <CardHeading title="This Week" icon={CalendarRange} />
        <WeekStats tasks={tasks} />
      </CardContent>
    </Card>
  );
}
