// src/components/tasks/TaskCard.tsx
"use client";

import { useDraggable } from "@dnd-kit/core";
import { CalendarDays, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDue, priorityStyles } from "@/components/tasks/TaskItem";
import { toDateKey, type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  onOpen: (task: Task) => void;
  onDelete: (task: Task) => void;
  onTagClick: (tag: string) => void;
}

// Longer descriptions are cut here and also clamped to two lines by CSS,
// so a card never grows past a short preview
const DESCRIPTION_MAX = 120;

function descriptionPreview(description: string) {
  const text = description.replace(/\s+/g, " ").trim();
  return text.length > DESCRIPTION_MAX ? `${text.slice(0, DESCRIPTION_MAX).trimEnd()}…` : text;
}

// "Sep 28", with the year when it is not the current one
function formatCreated(iso: string) {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== new Date().getFullYear() && { year: "numeric" }),
  });
}

// A board card. Drag it to another column to change the task's status;
// click (or Enter) opens it for editing.
export function TaskCard({ task, onOpen, onDelete, onTagClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });

  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription="Draggable task"
      aria-label={task.title}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        // Space picks the card up (dnd-kit); Enter opens it
        if (e.key === "Enter") onOpen(task);
        listeners?.onKeyDown?.(e);
      }}
      className={cn(
        "group cursor-grab touch-manipulation rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring",
        // The DragOverlay shows the moving copy; leave a faded placeholder behind
        isDragging && "opacity-40"
      )}
    >
      <TaskCardBody task={task} onDelete={onDelete} onTagClick={onTagClick} />
    </li>
  );
}

// Card content without drag behavior, also used for the DragOverlay copy
export function TaskCardBody({
  task,
  onDelete,
  onTagClick,
  lifted,
}: {
  task: Task;
  onDelete?: (task: Task) => void;
  onTagClick?: (tag: string) => void;
  // Rendered in the DragOverlay
  lifted?: boolean;
}) {
  const done = task.status === "done";
  const overdue = !done && !!task.dueDate && task.dueDate < toDateKey(new Date());

  return (
    <div
      className={cn(
        "rounded-md border bg-card p-3 shadow-xs transition-shadow hover:shadow-sm",
        lifted && "rotate-1 shadow-lg cursor-grabbing"
      )}
    >
      <div className="flex items-start gap-2">
        <p
          className={cn(
            "flex-1 min-w-0 text-sm font-medium break-words",
            done && "line-through text-muted-foreground"
          )}
        >
          {task.title}
        </p>
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task);
            }}
            // Keep a press on the button from starting a drag
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="-m-1 p-1 rounded opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 hover:bg-muted transition-opacity"
            aria-label={`Delete "${task.title}"`}
          >
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {task.description?.trim() && (
        <p
          className="mt-1 text-xs text-muted-foreground line-clamp-2 break-words"
          title={task.description}
        >
          {descriptionPreview(task.description)}
        </p>
      )}

      {(task.priority === "high" || task.dueDate || task.tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
          {task.priority === "high" && (
            <Badge className={cn("border-transparent capitalize", priorityStyles.high)}>High</Badge>
          )}
          {task.dueDate && (
            <span className={cn("flex items-center gap-1", overdue && "text-rose-600")}>
              <CalendarDays className="w-3.5 h-3.5" />
              {formatDue(task.dueDate)}
            </span>
          )}
          {task.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTagClick?.(tag);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="text-leaf hover:underline"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <p className="mt-2 text-[11px] text-muted-foreground/80">
        Created {formatCreated(task.createdAt)}
      </p>
    </div>
  );
}
