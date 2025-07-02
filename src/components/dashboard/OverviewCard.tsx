// src/components/dashboard/OverviewCard.tsx
'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Menu, MoreHorizontal } from 'lucide-react';

export interface OverviewCardProps {
  projects?: { id: string; name: string }[];
}

export function OverviewCard({ projects = [] }: OverviewCardProps) {
  // Manage simple expanded state for projects section
  const [expanded, setExpanded] = useState(false);

  // Determine which projects to display
  const visibleProjects = expanded ? projects : projects.slice(0, 3);

  return (
    <Card className="w-full hover:shadow-md bg-white dark:bg-gray-800">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Overview</h3>
          <Menu className="w-5 h-5 text-muted-foreground" />
        </div>

        {/* Projects Section */}
        <div className="divide-y divide-muted-foreground">
          <div className="py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Projects ({projects.length})
              </span>
              {projects.length > 3 && (
                <button
                  className="p-1 hover:bg-muted rounded"
                  onClick={() => setExpanded(!expanded)}
                  aria-label={expanded ? 'Show less' : 'Show more'}
                >
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* List items */}
            {visibleProjects.map((proj) => (
  <div key={proj.id} className="flex items-center justify-between py-1">
    <span className="inline-block bg-lime-100 dark:bg-lime-200 text-lime-600 px-2 py-1 rounded text-sm">
      {proj.name}
    </span>
    <button
      className="p-1 hover:bg-muted rounded"
      aria-label={`More options for ${proj.name}`}
      title="More"
    >
      <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
    </button>
  </div>
))}

            {/* Expand/Collapse label */}
            {projects.length > 3 && (
              <button
                className="mt-1 text-xs text-primary hover:underline"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Show less' : `+ ${projects.length - 3} more`}
              </button>
            )}
          </div>

          {/* Tasks Section (static placeholder) */}
          <div className="py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Tasks (0)
              </span>
            </div>
            <p className="text-sm text-muted-foreground">No tasks yet.</p>
          </div>

          {/* Team Members Section (static placeholder) */}
          <div className="py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Team Members (0)
              </span>
            </div>
            <p className="text-sm text-muted-foreground">No members yet.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
