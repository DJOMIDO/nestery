// src/components/dashboard/OverviewCard.tsx
'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { CardHeading } from './CardHeading';
import { Menu } from 'lucide-react';
import { compareTasks, tagCounts, type Task } from '@/lib/tasks';

const MAX_TASKS = 5;

export interface OverviewCardProps {
  tasks?: Task[];
}

// Next open tasks and the most used tags
export function OverviewCard({ tasks = [] }: OverviewCardProps) {
  const openTasks = tasks.filter((t) => t.status !== 'done').sort(compareTasks);
  const tags = tagCounts(openTasks);

  return (
    <Card className="w-full h-full rounded-lg hover:shadow-md bg-card">
      <CardContent className="p-4 flex-1 min-h-0 overflow-y-auto">
        <CardHeading title="Overview" icon={Menu} />

        <div className="divide-y divide-muted-foreground">
          {/* Tasks Section: next open tasks */}
          <div className="py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                Tasks ({openTasks.length})
              </span>
              <Link href="/tasks" className="text-xs text-primary hover:underline">
                View all
              </Link>
            </div>
            {openTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open tasks.</p>
            ) : (
              openTasks.slice(0, MAX_TASKS).map((task) => (
                <div key={task.id} className="py-1">
                  <span className="inline-block max-w-full truncate bg-leaf-soft text-leaf px-2 py-1 rounded text-sm">
                    {task.title}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Tags Section */}
          <div className="py-3">
            <span className="block text-sm font-medium text-muted-foreground mb-2">
              Tags ({tags.length})
            </span>
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tags yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map(({ tag, count }) => (
                  <span
                    key={tag}
                    className="inline-block bg-bark-soft text-bark px-2 py-1 rounded text-sm"
                  >
                    #{tag} <span className="opacity-70">{count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
