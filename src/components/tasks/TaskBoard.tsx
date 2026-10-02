// src/components/tasks/TaskBoard.tsx
"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { TaskBoardColumn } from "@/components/tasks/TaskBoardColumn";
import { TaskCardBody } from "@/components/tasks/TaskCard";
import {
  boardColumns,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type Task,
  type TaskStatus,
} from "@/lib/tasks";

interface TaskBoardProps {
  tasks: Task[];
  onMove: (task: Task, status: TaskStatus) => void;
  onAdd: (title: string, status: TaskStatus) => Promise<Task | null>;
  onOpen: (task: Task) => void;
  onDelete: (task: Task) => void;
  onTagClick: (tag: string) => void;
}

// Kanban view of the tasks: one column per status. Moving a card between
// columns changes the task's status.
export function TaskBoard({ tasks, onMove, onAdd, onOpen, onDelete, onTagClick }: TaskBoardProps) {
  const columns = useMemo(() => boardColumns(tasks), [tasks]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const byId = (id: unknown) => tasks.find((t) => t.id === id);
  const active = activeId ? byId(activeId) : undefined;

  const sensors = useSensors(
    // A small move starts a drag, so a click still opens the card
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // On touch, press and hold to drag so the board can still scroll
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    // Space picks up and drops; Enter is left to open the card
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    })
  );

  // Screen reader messages with task titles and column names instead of ids
  const columnName = (id: unknown) => TASK_STATUS_LABELS[id as TaskStatus] ?? "";
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up "${byId(active.id)?.title}".`,
    onDragOver: ({ active, over }) =>
      over ? `"${byId(active.id)?.title}" is over ${columnName(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `"${byId(active.id)?.title}" moved to ${columnName(over.id)}.`
        : `"${byId(active.id)?.title}" was dropped.`,
    onDragCancel: ({ active }) => `Moving "${byId(active.id)?.title}" was cancelled.`,
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const task = byId(active.id);
    const status = over?.id as TaskStatus | undefined;
    if (task && status && status !== task.status) onMove(task, status);
  };

  return (
    <DndContext
      sensors={sensors}
      accessibility={{ announcements }}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {/* Narrow screens scroll between columns; wide screens show all three */}
      <div className="flex flex-1 min-h-0 gap-4 overflow-x-auto snap-x snap-mandatory pb-2 lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0">
        {TASK_STATUSES.map((status) => (
          <TaskBoardColumn
            key={status}
            status={status}
            tasks={columns[status]}
            onAdd={onAdd}
            onOpen={onOpen}
            onDelete={onDelete}
            onTagClick={onTagClick}
          />
        ))}
      </div>

      <DragOverlay>{active && <TaskCardBody task={active} lifted />}</DragOverlay>
    </DndContext>
  );
}
