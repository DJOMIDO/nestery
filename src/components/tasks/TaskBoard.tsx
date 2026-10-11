// src/components/tasks/TaskBoard.tsx
"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("tasks");
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
  const columnName = (id: unknown) => t(`status.${id as TaskStatus}`);
  const announcements: Announcements = {
    onDragStart: ({ active }) => t("board.pickedUp", { title: byId(active.id)?.title ?? "" }),
    onDragOver: ({ active, over }) =>
      over ? t("board.over", { title: byId(active.id)?.title ?? "", column: columnName(over.id) }) : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t("board.moved", { title: byId(active.id)?.title ?? "", column: columnName(over.id) })
        : t("board.dropped", { title: byId(active.id)?.title ?? "" }),
    onDragCancel: ({ active }) => t("board.cancelled", { title: byId(active.id)?.title ?? "" }),
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
      {/* Columns stack on phones, sit two by two on tablets and four across
          on large screens, where each fills the height and scrolls */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:flex-1 lg:min-h-0 lg:grid-cols-4">
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
