// src/components/dashboard/MilestonesCard.tsx

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Milestone } from 'lucide-react';

interface Milestone {
  title: string;
  percent: number;
}

export function MilestonesCard() {
  const milestones: Milestone[] = [
    { title: "Design Phase", percent: 100 },
    { title: "Development Phase", percent: 75 },
    { title: "Testing Phase", percent: 40 },
    { title: "Deployment", percent: 0 },
  ];

  return (
    <Card className="w-full shadow-sm bg-white dark:bg-gray-800 hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4 group">
          <h3 className="text-lg font-semibold group-hover:text-muted-foreground transition-colors duration-200">Milestones</h3>
          <Milestone className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors duration-200" />
        </div>

        <div className="space-y-4">
          {milestones.map(({ title, percent }) => (
            <div key={title} className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-foreground">
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
