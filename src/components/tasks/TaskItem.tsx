// src/components/tasks/TaskItem.tsx
"use client";

import { Bell, CalendarDays, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TASK_STATUS_LABELS, toDateKey, type Task } from "@/lib/tasks";
import { useFormat } from "@/components/SettingsProvider";

export const priorityStyles: Record<Task["priority"], string> = {
  high: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-muted text-muted-foreground",
};

interface TaskItemProps {
  task: Task;
  selected?: boolean;
  onSelect?: (task: Task) => void;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onTagClick?: (tag: string) => void;
}

export function TaskItem({
  task,
  selected = false,
  onSelect,
  onToggle,
  onEdit,
  onDelete,
  onTagClick,
}: TaskItemProps) {
  const done = task.status === "done";
  const format = useFormat();
  const overdue = !done && !!task.dueDate && task.dueDate < toDateKey(new Date());

  return (
    <li
      className={cn(
        "group flex items-start gap-3 rounded-md px-3 py-2 hover:bg-muted/60",
        selected && "bg-primary/10 hover:bg-primary/10 dark:bg-primary/20"
      )}
    >
      <input
        type="checkbox"
        checked={done}
        onChange={() => onToggle(task)}
        aria-label={done ? `Mark "${task.title}" as not done` : `Complete "${task.title}"`}
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-primary"
      />

      <div
        className={cn("flex-1 min-w-0", onSelect && "cursor-pointer")}
        onClick={() => onSelect?.(task)}
      >
        <p
          className={cn(
            "text-sm font-medium break-words",
            done && "line-through text-muted-foreground"
          )}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {task.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
          <Badge className={cn("border-transparent capitalize", priorityStyles[task.priority])}>
            {task.priority}
          </Badge>
          {task.status === "in_progress" && <Badge variant="outline">{TASK_STATUS_LABELS.in_progress}</Badge>}
          {task.dueDate && (
            <span className={cn("flex items-center gap-1", overdue && "text-rose-600")}>
              <CalendarDays className="w-3.5 h-3.5" />
              {format.day(task.dueDate)}
            </span>
          )}
          {task.remindAt && (
            <span className="flex items-center gap-1">
              <Bell className="w-3.5 h-3.5" />
              {format.dayTime(task.remindAt)}
            </span>
          )}
          {task.tags.map((tag) => (
            <button
              key={tag}
              onClick={(e) => {
                e.stopPropagation();
                onTagClick?.(tag);
              }}
              className="text-leaf hover:underline"
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(task)}
          className="p-1.5 rounded hover:bg-muted"
          aria-label={`Edit "${task.title}"`}
        >
          <Pencil className="w-4 h-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => onDelete(task)}
          className="p-1.5 rounded hover:bg-muted"
          aria-label={`Delete "${task.title}"`}
        >
          <Trash2 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </li>
  );
}
