// src/components/tasks/TaskDetailPanel.tsx
"use client";

import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskForm } from "@/components/tasks/TaskForm";
import type { TaskInput } from "@/hooks/useTasks";
import type { Task } from "@/lib/tasks";

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

interface TaskDetailPanelProps {
  task: Task;
  onSave: (input: TaskInput) => Promise<unknown>;
  onDelete: () => void;
  onClose: () => void;
}

export function TaskDetailPanel({ task, onSave, onDelete, onClose }: TaskDetailPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Task details</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-muted"
          aria-label="Close details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Remount when the task changes (another task, or saved elsewhere) */}
      <TaskForm
        key={`${task.id}-${task.updatedAt}`}
        task={task}
        idPrefix="task-panel"
        onSubmit={onSave}
        extraActions={
          <Button type="button" variant="outline" onClick={onDelete}>
            <Trash2 className="w-4 h-4 mr-1" /> Delete
          </Button>
        }
      />

      <p className="text-xs text-muted-foreground">
        Created {formatTime(task.createdAt)}
        {task.completedAt && ` · Completed ${formatTime(task.completedAt)}`}
      </p>
    </div>
  );
}
