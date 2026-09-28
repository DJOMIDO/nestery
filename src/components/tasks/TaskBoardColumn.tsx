// src/components/tasks/TaskBoardColumn.tsx
"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TASK_STATUS_LABELS, type Task, type TaskStatus } from "@/lib/tasks";
import { cn } from "@/lib/utils";

// Done can grow without limit, so only the most recent are shown at first
const DONE_PREVIEW = 10;

interface TaskBoardColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onAdd: (title: string, status: TaskStatus) => Promise<unknown>;
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

  const isDone = status === "done";
  const shown = isDone && !showAll ? tasks.slice(0, DONE_PREVIEW) : tasks;
  const hidden = tasks.length - shown.length;
  const label = TASK_STATUS_LABELS[status];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    if (await onAdd(trimmed, status)) setTitle("");
  };

  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={cn(
        "flex flex-col min-h-0 w-[85vw] max-w-sm shrink-0 snap-start lg:w-auto lg:max-w-none",
        "rounded-lg border bg-muted/40 transition-colors",
        isOver && "border-leaf bg-leaf-soft/60"
      )}
    >
      <h2 className="flex items-center justify-between px-3 pt-3 pb-2 text-sm font-semibold">
        {label}
        <span className="rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">
          {tasks.length}
        </span>
      </h2>

      <ul className="flex-1 min-h-24 overflow-y-auto space-y-2 px-3 pb-2">
        {shown.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onOpen={onOpen}
            onDelete={onDelete}
            onTagClick={onTagClick}
          />
        ))}
        {tasks.length === 0 && (
          <li className="py-6 text-center text-xs text-muted-foreground">
            {isDone ? "Drag tasks here to complete them" : "No tasks"}
          </li>
        )}
      </ul>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mx-3 mb-3 text-xs text-muted-foreground hover:text-foreground"
        >
          Show {hidden} more
        </button>
      )}

      {!isDone && (
        <form onSubmit={handleAdd} className="px-3 pb-3">
          <div className="relative">
            <Plus className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a task"
              aria-label={`Add a task to ${label}`}
              className="h-8 pl-8 bg-card"
            />
          </div>
        </form>
      )}
    </section>
  );
}
