// src/components/dashboard/MilestonesCard.tsx

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Milestone } from 'lucide-react';
import type { Task } from "@/lib/tasks";

const MAX_ITEMS = 4;

interface MilestonesCardProps {
  projects: { id: string; name: string }[];
  tasks: Task[];
}

// Completion rate per project: done tasks / all tasks in that project
export function MilestonesCard({ projects, tasks }: MilestonesCardProps) {
  const milestones = projects
    .map((project) => {
      const projectTasks = tasks.filter((t) => t.projectId === project.id);
      const done = projectTasks.filter((t) => t.status === "done").length;
      return {
        id: project.id,
        title: project.name,
        total: projectTasks.length,
        percent: projectTasks.length
          ? Math.round((done / projectTasks.length) * 100)
          : 0,
      };
    })
    .filter((m) => m.total > 0)
    .slice(0, MAX_ITEMS);

  return (
    <Card className="w-full shadow-sm bg-white dark:bg-gray-800 hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4 group">
          <h3 className="text-lg font-semibold group-hover:text-muted-foreground transition-colors duration-200">Milestones</h3>
          <Milestone className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors duration-200" />
        </div>

        {milestones.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Add tasks to a project to track its progress.
          </p>
        )}

        <div className="space-y-4">
          {milestones.map(({ id, title, percent }) => (
            <div key={id} className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-foreground truncate">
                  {title}
                </span>
                <span className="text-sm font-medium">{percent}%</span>
              </div>

              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`
      h-2 rounded-full
      ${
        percent === 100
          ? "bg-lime-500 dark:bg-lime-400"
          : percent >= 50
          ? "bg-amber-400 dark:bg-amber-300"
          : "bg-rose-500 dark:bg-rose-400"
      }
    `}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
