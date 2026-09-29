// src/components/calendar/dnd.tsx
// Drag-and-drop pieces shared by the month and week views. The DndContext
// lives on the calendar page, which applies the drops.

"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { CalendarEvent, CalendarItem } from "@/lib/calendar";
import { cn } from "@/lib/utils";

// What is being dragged: an item moved to another day or time, or the end of
// a timed event being resized
export type DragData =
  | { type: "move"; item: CalendarItem; day: string }
  | { type: "resize"; event: CalendarEvent; day: string };

// Where it is dropped: a day, and whether that spot has a time axis (week columns)
export interface DropData {
  day: string;
  timed: boolean;
}

// Your own events and tasks can be rescheduled; holidays, reminders and
// events from subscribed calendars stay put
export const canDrag = (item: CalendarItem) =>
  (item.kind === "event" && !item.event.source) || item.kind === "task";

interface DraggableItemProps {
  item: CalendarItem;
  day: string;
  // Opened by a click or Enter; Space picks the item up
  onOpen: (item: CalendarItem) => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function DraggableItem({ item, day, onOpen, className, style, children }: DraggableItemProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    // The same event can show on several days; each copy drags on its own
    id: `move:${item.id}:${day}`,
    data: { type: "move", item, day } satisfies DragData,
    disabled: !canDrag(item),
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription={canDrag(item) ? "Draggable item" : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(item);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(item);
        listeners?.onKeyDown?.(e);
      }}
      style={style}
      className={cn(
        "cursor-pointer rounded outline-none focus-visible:ring-2 focus-visible:ring-ring",
        canDrag(item) && "cursor-grab touch-manipulation",
        isDragging && "opacity-40",
        className
      )}
    >
      {children}
    </div>
  );
}

// The bottom edge of a timed event in the week view; drag it to change the end time
export function ResizeHandle({ event, day }: { event: CalendarEvent; day: string }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `resize:${event.id}:${day}`,
    data: { type: "resize", event, day } satisfies DragData,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription="Resize handle"
      aria-label={`Change when "${event.title}" ends`}
      onClick={(e) => e.stopPropagation()}
      className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-manipulation rounded-b outline-none focus-visible:bg-leaf/40"
    />
  );
}

interface DayDropProps {
  day: string;
  timed?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  dropRef?: (node: HTMLDivElement | null) => void;
}

// A drop target for one day: a month cell, an all-day cell, or a week column
export function DayDrop({ day, timed = false, className, children, onClick, dropRef }: DayDropProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${timed ? "col" : "day"}:${day}`,
    data: { day, timed } satisfies DropData,
  });

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        dropRef?.(node);
      }}
      onClick={onClick}
      className={cn(className, isOver && "bg-leaf-soft/50")}
    >
      {children}
    </div>
  );
}
