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
import { MilestonesCard } from "@/components/dashboard/MilestonesCard";
import NewProjectModal from "@/components/projects/NewProjectModal";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";

export default function DashboardPage() {
  const { projects, reload: reloadProjects } = useProjects();
  const { tasks, createTask } = useTasks();
  const [isNewProjOpen, setIsNewProjOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  // Re-fetch after creating a new project
  const handleNewProjectCreated = async () => {
    setIsNewProjOpen(false);
    await reloadProjects();
  };

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
        <OverviewCard projects={projects} tasks={tasks} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6 auto-rows-min lg:col-span-2">
          <QuickActionCard
            onNewProject={() => setIsNewProjOpen(true)}
            onAddTask={() => setIsNewTaskOpen(true)}
          />
          <RecentActivityCard />
          <DeadlinesCard tasks={tasks} />
          <MilestonesCard projects={projects} tasks={tasks} />
        </div>
      </div>

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={isNewProjOpen}
        onClose={() => setIsNewProjOpen(false)}
        onCreated={handleNewProjectCreated}
      />

      <TaskDialog
        open={isNewTaskOpen}
        onOpenChange={setIsNewTaskOpen}
        projects={projects}
        onSubmit={createTask}
      />
    </div>
  );
}
