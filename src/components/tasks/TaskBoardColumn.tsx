// src/components/tasks/TaskBoardColumn.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Circle, CircleCheck, Clock, Contrast, Plus, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TASK_STATUS_LABELS, type Task, type TaskStatus } from "@/lib/tasks";
import { cn } from "@/lib/utils";

// Done can grow without limit, so only the most recent are shown at first
const DONE_PREVIEW = 10;

// How long a newly added card stays outlined
const HIGHLIGHT_MS = 1500;

// Each column's mark, from grey (not started) to forest green (done)
const STATUS_ICONS: Record<TaskStatus, { icon: LucideIcon; className: string }> = {
  todo: { icon: Circle, className: "text-muted-foreground" },
  in_progress: { icon: Contrast, className: "text-moss" },
  waiting: { icon: Clock, className: "text-bark" },
  done: { icon: CircleCheck, className: "text-leaf" },
};

interface TaskBoardColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onAdd: (title: string, status: TaskStatus) => Promise<Task | null>;
  onOpen: (task: Task) => void;
  onDelete: (task: Task) => void;
  onTagClick: (tag: string) => void;
}

export function TaskBoardColumn({
  status,
  tasks,
  onAdd,
  onOpen,
  onDelete,
  onTagClick,
}: TaskBoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [title, setTitle] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [addedId, setAddedId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const isDone = status === "done";
  const shown = isDone && !showAll ? tasks.slice(0, DONE_PREVIEW) : tasks;
  const hidden = tasks.length - shown.length;
  const label = TASK_STATUS_LABELS[status];
  const { icon: StatusIcon, className: statusClass } = STATUS_ICONS[status];

  // The column keeps its sort order, so a new task may land below the fold:
  // scroll it into view and outline it for a moment
  useEffect(() => {
    if (!addedId) return;
    const card = listRef.current?.querySelector(`[data-task-id="${addedId}"]`);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    const timer = setTimeout(() => setAddedId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [addedId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    const task = await onAdd(trimmed, status);
    if (task) {
      setTitle("");
      setAddedId(task.id);
    }
  };

  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={cn(
        "relative flex flex-col min-h-0",
        // A lane rather than a box: the cards carry the borders
        "rounded-xl bg-foreground/[0.03] transition-colors",
        isOver && "bg-leaf-soft/60 ring-2 ring-leaf/50"
      )}
    >
      <h2 className="flex items-center gap-2 px-3 pt-3 pb-2 text-sm font-semibold">
        <StatusIcon className={cn("size-4 shrink-0", statusClass)} />
        {label}
        <span className="text-xs font-medium text-muted-foreground">{tasks.length}</span>
      </h2>

      {!isDone && (
        <form onSubmit={handleAdd} className="px-3 pb-2">
          <div className="relative">
            <Plus className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add task"
              aria-label={`Add a task to ${label}`}
              // A quiet line until it's used
              className="h-8 pl-8 border-transparent bg-transparent shadow-none hover:bg-foreground/5 focus-visible:border-input focus-visible:bg-card dark:bg-transparent dark:focus-visible:bg-card"
            />
          </div>
        </form>
      )}

      {/* pt-1 leaves room for the outline of a highlighted first card */}
      <ul ref={listRef} className="flex-1 min-h-24 overflow-y-auto space-y-2 px-3 pt-1 pb-3">
        {shown.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onOpen={onOpen}
            onDelete={onDelete}
            onTagClick={onTagClick}
            highlighted={task.id === addedId}
          />
        ))}
      </ul>

      {/* Centered on the whole column, so the message lines up across columns
          whether or not they have the add field */}
      {tasks.length === 0 && (
        <p className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 text-center text-xs text-muted-foreground">
          {isDone ? "Drag tasks here to complete them" : "No tasks"}
        </p>
      )}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mx-3 mb-3 text-xs text-muted-foreground hover:text-foreground"
        >
          Show {hidden} more
        </button>
      )}
    </section>
  );
}
