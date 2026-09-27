// src/app/dashboard/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { WelcomeCard } from "@/components/dashboard/WelcomeCard";
import { DateCard } from "@/components/dashboard/DateCard";
import { ReminderCard } from "@/components/dashboard/ReminderCard";
import { OverviewCard } from "@/components/dashboard/OverviewCard";
import { QuickActionCard } from "@/components/dashboard/QuickActionCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { DeadlinesCard } from "@/components/dashboard/DeadlinesCard";
import { MilestonesCard } from "@/components/dashboard/MilestonesCard";
import NewProjectModal, {
  Project,
} from "@/components/projects/NewProjectModal";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isNewProjOpen, setIsNewProjOpen] = useState(false);

  // Fetch the latest projects for both Overview and Dashboard
  const loadProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data: Project[] = await res.json();
      setProjects(data);
    } catch (err) {
      console.error("Error loading projects:", err);
    }
  };

  // Initial load
  useEffect(() => {
    loadProjects();
  }, []);

  // Re-fetch after creating a new project
  const handleNewProjectCreated = async () => {
    setIsNewProjOpen(false);
    await loadProjects();
  };

  return (
    <div className="space-y-6 p-2">
      {/* Top row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <WelcomeCard />
        <DateCard />
        <ReminderCard />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <OverviewCard projects={projects} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6 auto-rows-min lg:col-span-2">
          <QuickActionCard onNewProject={() => setIsNewProjOpen(true)} />
          <RecentActivityCard />
          <DeadlinesCard />
          <MilestonesCard />
        </div>
      </div>

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={isNewProjOpen}
        onClose={() => setIsNewProjOpen(false)}
        onCreated={handleNewProjectCreated}
      />
    </div>
  );
}
