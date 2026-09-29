// src/app/(app)/calendar/page.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
} from "@dnd-kit/core";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DayAgenda } from "@/components/calendar/DayAgenda";
import { EventDialog, type EditScope } from "@/components/calendar/EventDialog";
import { EventDetailsDialog } from "@/components/calendar/EventDetailsDialog";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { PX_PER_MINUTE, WeekView } from "@/components/calendar/WeekView";
import type { DragData, DropData } from "@/components/calendar/dnd";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { useEvents, type EventInput } from "@/hooks/useEvents";
import { useHolidays } from "@/hooks/useHolidays";
import { useStoredChoice } from "@/hooks/useStoredChoice";
import { useSubscriptionEvents, useSubscriptions } from "@/hooks/useSubscriptions";
import { SUBSCRIPTION_COLORS } from "@/lib/subscriptions";
import { useFormat, useHolidayCountries } from "@/components/SettingsProvider";
import { useTasks } from "@/hooks/useTasks";
import {
  dayDiff,
  eventKey,
  itemsByDay,
  monthGrid,
  movedTiming,
  resizedTiming,
  seriesTimingFrom,
  shiftMonth,
  snapMinutes,
  weekDays,
  type CalendarEvent,
  type CalendarItem,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { addDays, toDateKey, type Task } from "@/lib/tasks";

type CalendarView = "month" | "week";

// Drop on whatever is under the pointer; keyboard dragging has no pointer, so
// it falls back to overlapping rectangles
const collisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  return underPointer.length > 0 ? underPointer : rectIntersection(args);
};
const VIEWS = ["month", "week"] as const;

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export default function CalendarPage() {
  const today = toDateKey(new Date());
  const [view, setView] = useStoredChoice<CalendarView>("calendar-view", VIEWS, "month");
  const [month, setMonth] = useState(() => today.slice(0, 8) + "01");
  const [selected, setSelected] = useState(today);

  const format = useFormat();
  const days = useMemo(
    () => (view === "month" ? monthGrid(month, format.weekStart) : weekDays(selected, format.weekStart)),
    [view, month, selected, format.weekStart]
  );
  const first = days[0];
  const last = days[days.length - 1];

  const { tasks, updateTask } = useTasks();
  const { events, occurrences, createEvent, updateEvent, deleteEvent } = useEvents(first, last);
  // Subscribed calendars: read-only, reloaded when one is switched on or off
  const { subscriptions, update: updateSubscription } = useSubscriptions();
  const enabledKey = subscriptions.filter((s) => s.enabled).map((s) => s.id).join(",");
  const subscribedEvents = useSubscriptionEvents(first, last, enabledKey);
  const shownEvents = useMemo(() => [...occurrences, ...subscribedEvents], [occurrences, subscribedEvents]);
  const { countries, guessed } = useHolidayCountries();
  // The visible days can span two years around January and December
  const years = useMemo(
    () => [...new Set([first, last].map((d) => Number(d.slice(0, 4))))],
    [first, last]
  );
  const holidays = useHolidays(countries, years);

  const items = useMemo(
    () => itemsByDay(days, { events: shownEvents, tasks, holidays }),
    [days, shownEvents, tasks, holidays]
  );

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  // Start time for a new event created from an empty slot in the week view
  const [newEventTime, setNewEventTime] = useState<string | undefined>();
  // Kept after closing so the dialog does not flash an empty form while it animates out
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [viewingEvent, setViewingEvent] = useState<CalendarEvent | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const title =
    view === "month"
      ? format.monthYear(month)
      : `${format.day(first)} – ${format.dayWithYear(last)}`;

  const goToMonth = (next: string) => {
    setMonth(next);
    // Keep today selected when returning to its month; otherwise the 1st
    setSelected(next.slice(0, 7) === today.slice(0, 7) ? today : next);
  };

  // Selecting a day outside the shown month also switches the month
  const selectDay = (day: string) => {
    setSelected(day);
    if (day.slice(0, 7) !== month.slice(0, 7)) setMonth(day.slice(0, 8) + "01");
  };

  const step = (direction: -1 | 1) =>
    view === "month" ? goToMonth(shiftMonth(month, direction)) : selectDay(addDays(selected, 7 * direction));
  const goToToday = () => (view === "month" ? goToMonth(today.slice(0, 8) + "01") : selectDay(today));

  const openNewEvent = (time?: string) => {
    setEditingEvent(null);
    setNewEventTime(time);
    setEventDialogOpen(true);
  };

  const openItem = (item: CalendarItem) => {
    if (item.kind === "event" && item.event.source) {
      setViewingEvent(item.event);
      setDetailsOpen(true);
    } else if (item.kind === "event") {
      setEditingEvent(item.event);
      setEventDialogOpen(true);
    } else if (item.kind === "task" || item.kind === "reminder") {
      setEditingTask(item.task);
      setTaskDialogOpen(true);
    }
  };

  // ---- Repeating events --------------------------------------------------

  // The stored series behind an expanded occurrence
  const seriesOf = (event: CalendarEvent) =>
    event.occurrenceDate ? events.find((e) => e.id === event.id) : undefined;

  const timingOf = (e: Pick<CalendarEvent, "allDay" | "startDate" | "endDate" | "startsAt" | "endsAt">): EventInput =>
    e.allDay
      ? { allDay: true, startDate: e.startDate, endDate: e.endDate }
      : { allDay: false, startsAt: e.startsAt, endsAt: e.endsAt };

  // "Only this event": the occurrence becomes its own event, and the series
  // skips that date from now on
  const detachOccurrence = async (series: CalendarEvent, occurrence: CalendarEvent, input: EventInput) => {
    const created = await createEvent({
      title: occurrence.title,
      notes: occurrence.notes,
      ...timingOf(occurrence),
      ...input,
      rrule: null,
      seriesId: series.id,
    });
    if (!created) return null;
    await updateEvent(series.id, { exdates: [...series.exdates, occurrence.occurrenceDate!] });
    return created;
  };

  const handleEventSubmit = (input: EventInput, scope: EditScope) => {
    if (!editingEvent) return createEvent(input);
    const series = seriesOf(editingEvent);
    if (!series) return updateEvent(editingEvent.id, input);
    if (scope === "one") return detachOccurrence(series, editingEvent, input);
    // "All events": the occurrence's new day and time carry over to the series
    const timing = "allDay" in input ? seriesTimingFrom(series, editingEvent, input as Parameters<typeof seriesTimingFrom>[2]) : {};
    return updateEvent(series.id, { ...input, ...timing });
  };

  const handleDeleteEvent = async (event: CalendarEvent, scope: EditScope = "all") => {
    const series = seriesOf(event);
    if (series && scope === "one") {
      const date = event.occurrenceDate!;
      if (!(await updateEvent(series.id, { exdates: [...series.exdates, date] }))) return;
      toast("Event deleted", {
        action: {
          label: "Undo",
          onClick: () => updateEvent(series.id, { exdates: series.exdates.filter((d) => d !== date) }),
        },
      });
      return;
    }
    const target = series ?? event;
    if (!(await deleteEvent(target.id))) return;
    toast(target.rrule ? "Repeating event deleted" : "Event deleted", {
      action: {
        label: "Undo",
        onClick: () =>
          createEvent({
            title: target.title,
            notes: target.notes,
            ...timingOf(target),
            rrule: target.rrule,
            exdates: target.exdates,
          }),
      },
    });
  };

  // ---- Drag and drop -------------------------------------------------------

  const sensors = useSensors(
    // A small move starts a drag, so a click still opens the item
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // On touch, press and hold to drag so the calendar can still scroll
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    // Space picks up and drops; Enter is left to open the item
    useSensor(KeyboardSensor, { keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] } })
  );

  const [dragging, setDragging] = useState<DragData | null>(null);
  // Where the dragged item would land, shown next to the pointer
  const [dropLabel, setDropLabel] = useState<string | null>(null);
  const [resizing, setResizing] = useState<{ eventId: string; minutes: number } | null>(null);

  // What a drop at this point would do: new timing for an event, new due date for a task
  const planDrop = (data: DragData, target: DropData | undefined, deltaY: number) => {
    if (data.type === "resize") {
      const minutes = snapMinutes(deltaY / PX_PER_MINUTE);
      return minutes ? { event: data.event, timing: resizedTiming(data.event, minutes) } : null;
    }
    if (!target) return null;
    const days = dayDiff(data.day, target.day);
    const { item } = data;
    if (item.kind === "event") {
      // Within the time grid, vertical movement shifts the time too
      const minutes = target.timed && !item.event.allDay ? snapMinutes(deltaY / PX_PER_MINUTE) : 0;
      if (days === 0 && minutes === 0) return null;
      return { event: item.event, timing: movedTiming(item.event, days, minutes) };
    }
    if (item.kind === "task" && days !== 0) return { task: item.task, dueDate: target.day };
    return null;
  };

  const describeDrop = (plan: ReturnType<typeof planDrop>) => {
    if (!plan) return null;
    if ("task" in plan) return `Due ${format.dayWithWeekday(plan.dueDate!)}`;
    const t = plan.timing;
    if (t.allDay) return t.startDate === t.endDate ? format.dayWithWeekday(t.startDate) : `${format.day(t.startDate)} – ${format.day(t.endDate)}`;
    return `${format.weekday(t.startsAt)} ${format.time(t.startsAt)} – ${format.time(t.endsAt)}`;
  };

  const handleDragMove = ({ active, over, delta }: DragMoveEvent) => {
    const data = active.data.current as DragData;
    if (data.type === "resize") setResizing({ eventId: eventKey(data.event), minutes: delta.y / PX_PER_MINUTE });
    setDropLabel(describeDrop(planDrop(data, over?.data.current as DropData | undefined, delta.y)));
  };

  const endDrag = () => {
    setDragging(null);
    setDropLabel(null);
    setResizing(null);
  };

  const handleDragEnd = ({ active, over, delta }: DragEndEvent) => {
    endDrag();
    const plan = planDrop(active.data.current as DragData, over?.data.current as DropData | undefined, delta.y);
    if (!plan) return;
    if ("task" in plan) return updateTask(plan.task!.id, { dueDate: plan.dueDate });
    const series = seriesOf(plan.event);
    if (!series) return updateEvent(plan.event.id, plan.timing);
    // Dragging an occurrence of a repeating event moves just that one
    detachOccurrence(series, plan.event, plan.timing).then(
      (moved) => moved && toast.info("Moved this occurrence only. Edit the event to change the whole series.")
    );
  };

  const draggedTitle =
    dragging?.type === "move"
      ? dragging.item.kind === "event"
        ? dragging.item.event.title
        : dragging.item.kind === "task"
          ? dragging.item.task.title
          : null
      : null;

  return (
    // Fills the viewport on large screens: calendar on the left, the day's agenda on the right
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={({ active }) => setDragging(active.data.current as DragData)}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={endDrag}
    >
      <div className="grid grid-cols-1 gap-6 lg:h-full lg:min-h-0 lg:grid-cols-[1fr_20rem] lg:grid-rows-1">
        <div className="flex min-h-0 min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">{title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="View" className="flex rounded-md border p-0.5">
                {[
                  { value: "month" as const, label: "Month", icon: CalendarDays },
                  { value: "week" as const, label: "Week", icon: CalendarRange },
                ].map(({ value, label, icon: Icon }) => (
                  <Button
                    key={value}
                    variant="ghost"
                    size="sm"
                    className={cn("h-8 gap-1.5", view === value && "bg-leaf-soft text-leaf hover:bg-leaf-soft hover:text-leaf")}
                    onClick={() => setView(value)}
                    aria-pressed={view === value}
                  >
                    <Icon className="size-4" /> {label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center rounded-md border">
                <Button variant="ghost" size="icon" className="size-8" onClick={() => step(-1)} aria-label={`Previous ${view}`}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8" onClick={goToToday}>
                  Today
                </Button>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => step(1)} aria-label={`Next ${view}`}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
              <Button onClick={() => openNewEvent()}>
                <Plus className="size-4 mr-1" /> New Event
              </Button>
            </div>
          </div>

          {subscriptions.length > 0 && (
            <div role="group" aria-label="Subscribed calendars" className="flex flex-wrap items-center gap-2 text-xs">
              {subscriptions.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => updateSubscription(sub.id, { enabled: !sub.enabled })}
                  aria-pressed={sub.enabled}
                  title={sub.lastError ? `Last refresh failed: ${sub.lastError}` : undefined}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors",
                    sub.enabled ? "bg-card" : "text-muted-foreground opacity-60 hover:opacity-100"
                  )}
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      sub.enabled ? SUBSCRIPTION_COLORS[sub.color].dot : "border border-current"
                    )}
                  />
                  {sub.name}
                  {sub.lastError && <span className="text-destructive">!</span>}
                </button>
              ))}
              <Link href="/settings?section=calendars" className="text-muted-foreground underline-offset-2 hover:underline">
                Manage
              </Link>
            </div>
          )}

          {guessed && (
            <p className="text-xs text-muted-foreground">
              {countries.length > 0
                ? `Showing ${countries.join(", ")} holidays based on your browser.`
                : "No public holidays shown."}{" "}
              <Link href="/settings?section=holidays" className="text-leaf underline-offset-2 hover:underline">
                Choose countries and regions
              </Link>
            </p>
          )}

          {view === "month" ? (
            <MonthGrid
              month={month}
              days={days}
              items={items}
              today={today}
              selected={selected}
              onSelect={selectDay}
              onOpen={openItem}
            />
          ) : (
            <WeekView
              days={days}
              items={items}
              events={shownEvents}
              today={today}
              selected={selected}
              onSelect={selectDay}
              onOpen={openItem}
              onCreateAt={(day, minutes) => {
                selectDay(day);
                openNewEvent(hhmm(minutes));
              }}
              resizing={resizing}
            />
          )}
        </div>

        <DayAgenda
          day={selected}
          items={items.get(selected) ?? []}
          onOpen={openItem}
          onNewEvent={() => openNewEvent()}
        />
      </div>

      {/* Follows the pointer while moving an item, with where it would land */}
      <DragOverlay dropAnimation={null}>
        {draggedTitle && (
          <div className="w-max max-w-56 cursor-grabbing rounded-md border bg-popover px-2 py-1 text-xs shadow-lg">
            <p className="truncate font-medium">{draggedTitle}</p>
            {dropLabel && <p className="text-leaf">{dropLabel}</p>}
          </div>
        )}
      </DragOverlay>
      {/* Resizing keeps the block in place; the label shows the new end time */}
      {dragging?.type === "resize" && dropLabel && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md border bg-popover px-3 py-1.5 text-xs shadow-lg">
          {dragging.event.title}: <span className="text-leaf">{dropLabel}</span>
        </div>
      )}

      <EventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        event={editingEvent}
        defaultDate={selected}
        defaultTime={newEventTime}
        onSubmit={handleEventSubmit}
        onDelete={handleDeleteEvent}
      />
      <EventDetailsDialog event={viewingEvent} open={detailsOpen} onOpenChange={setDetailsOpen} />
      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        task={editingTask}
        onSubmit={(input) => updateTask(editingTask!.id, input)}
      />
    </DndContext>
  );
}
