// src/app/(app)/dashboard/page.tsx
"use client";

import React, { useState } from "react";
import { WelcomeCard } from "@/components/dashboard/WelcomeCard";
import { DateCard } from "@/components/dashboard/DateCard";
import { ReminderCard } from "@/components/dashboard/ReminderCard";
import { OverviewCard } from "@/components/dashboard/OverviewCard";
import { QuickActionCard } from "@/components/dashboard/QuickActionCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { DeadlinesCard } from "@/components/dashboard/DeadlinesCard";
import { WeekCard } from "@/components/dashboard/WeekCard";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { useTasks } from "@/hooks/useTasks";

export default function DashboardPage() {
  const { tasks, createTask } = useTasks();
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  return (
    // On large screens the dashboard fits the viewport; cards scroll inside
    <div className="space-y-6 p-2 lg:h-full lg:flex lg:flex-col lg:space-y-0 lg:gap-6">
      {/* Top row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:shrink-0">
        <WelcomeCard />
        <DateCard />
        <ReminderCard tasks={tasks} />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:flex-1 lg:min-h-0 lg:grid-rows-1">
        <OverviewCard tasks={tasks} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:col-span-2 lg:grid-rows-2 lg:min-h-0">
          <QuickActionCard onAddTask={() => setIsNewTaskOpen(true)} />
          <RecentActivityCard tasks={tasks} />
          <DeadlinesCard tasks={tasks} />
          <WeekCard tasks={tasks} />
        </div>
      </div>

      <TaskDialog
        open={isNewTaskOpen}
        onOpenChange={setIsNewTaskOpen}
        onSubmit={createTask}
      />
    </div>
  );
}
