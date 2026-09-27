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
    <div className="space-y-6 p-2">
      {/* Top row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <WelcomeCard />
        <DateCard />
        <ReminderCard tasks={tasks} />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <OverviewCard tasks={tasks} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6 auto-rows-min lg:col-span-2">
          <QuickActionCard onAddTask={() => setIsNewTaskOpen(true)} />
          <RecentActivityCard />
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
