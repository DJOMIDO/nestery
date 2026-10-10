// src/components/tasks/TaskCard.tsx
"use client";

import { useDraggable } from "@dnd-kit/core";
import { CalendarDays, Flag, Trash2 } from "lucide-react";
import { toDateKey, type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { useFormat } from "@/components/SettingsProvider";

interface TaskCardProps {
  task: Task;
  onOpen: (task: Task) => void;
  onDelete: (task: Task) => void;
  onTagClick: (tag: string) => void;
  // Briefly outlined after being added, to show where it landed
  highlighted?: boolean;
}

// Longer descriptions are cut here and also clamped to two lines by CSS,
// so a card never grows past a short preview
const DESCRIPTION_MAX = 120;

function descriptionPreview(description: string) {
  const text = description.replace(/\s+/g, " ").trim();
  return text.length > DESCRIPTION_MAX ? `${text.slice(0, DESCRIPTION_MAX).trimEnd()}…` : text;
}

// A board card. Drag it to another column to change the task's status;
// click (or Enter) opens it for editing.
export function TaskCard({ task, onOpen, onDelete, onTagClick, highlighted }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });

  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-task-id={task.id}
      aria-roledescription="Draggable task"
      aria-label={task.title}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        // Space picks the card up (dnd-kit); Enter opens it
        if (e.key === "Enter") onOpen(task);
        listeners?.onKeyDown?.(e);
      }}
      className={cn(
        "group cursor-grab touch-manipulation rounded-lg outline-none transition-shadow duration-500 focus-visible:ring-2 focus-visible:ring-ring",
        highlighted && "ring-2 ring-leaf",
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
  const format = useFormat();
  const overdue = !done && !!task.dueDate && task.dueDate < toDateKey(new Date());

  return (
    <div
      className={cn(
        // Flat like other cards: hovering darkens the border instead of a shadow
        "rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20",
        // Done cards step back, so the open ones stand out
        done && "opacity-70",
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
          {task.priority === "high" && !done && (
            <Flag className="mr-1 inline size-3.5 -translate-y-px text-rose-600" aria-label="High priority" />
          )}
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

      {!done && task.description?.trim() && (
        <p
          className="mt-1 text-xs text-muted-foreground line-clamp-2 break-words"
          title={task.description}
        >
          {descriptionPreview(task.description)}
        </p>
      )}

      {(task.dueDate || task.tags.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
          {task.dueDate && (
            <span className={cn("flex items-center gap-1", overdue && "text-rose-600")}>
              <CalendarDays className="w-3.5 h-3.5" />
              {format.day(task.dueDate)}
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
              className="rounded bg-bark-soft px-1.5 py-0.5 text-bark hover:bg-bark/20"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
