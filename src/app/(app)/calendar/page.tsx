// src/app/(app)/calendar/page.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DayAgenda } from "@/components/calendar/DayAgenda";
import { EventDialog } from "@/components/calendar/EventDialog";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { useEvents, type EventInput } from "@/hooks/useEvents";
import { useHolidays } from "@/hooks/useHolidays";
import { useFormat, useHolidayCountries } from "@/components/SettingsProvider";
import { useTasks } from "@/hooks/useTasks";
import {
  itemsByDay,
  monthGrid,
  shiftMonth,
  type CalendarEvent,
  type CalendarItem,
} from "@/lib/calendar";
import { toDateKey, type Task } from "@/lib/tasks";

export default function CalendarPage() {
  const today = toDateKey(new Date());
  const [month, setMonth] = useState(() => today.slice(0, 8) + "01");
  const [selected, setSelected] = useState(today);

  const format = useFormat();
  const days = useMemo(() => monthGrid(month, format.weekStart), [month, format.weekStart]);
  const first = days[0];
  const last = days[days.length - 1];

  const { tasks, updateTask } = useTasks();
  const { events, createEvent, updateEvent, deleteEvent } = useEvents(first, last);
  const { countries, guessed } = useHolidayCountries();
  // The grid can span two years around January and December
  const years = useMemo(
    () => [...new Set([first, last].map((d) => Number(d.slice(0, 4))))],
    [first, last]
  );
  const holidays = useHolidays(countries, years);

  const items = useMemo(
    () => itemsByDay(days, { events, tasks, holidays }),
    [days, events, tasks, holidays]
  );

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  // Kept after closing so the dialog does not flash an empty form while it animates out
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);

  const title = format.monthYear(month);

  const goToMonth = (next: string) => {
    setMonth(next);
    // Keep today selected when returning to its month; otherwise the 1st
    setSelected(next.slice(0, 7) === today.slice(0, 7) ? today : next);
  };

  // Clicking a day in the leading/trailing week also switches the month
  const selectDay = (day: string) => {
    setSelected(day);
    if (day.slice(0, 7) !== month.slice(0, 7)) setMonth(day.slice(0, 8) + "01");
  };

  const openNewEvent = () => {
    setEditingEvent(null);
    setEventDialogOpen(true);
  };

  const openItem = (item: CalendarItem) => {
    if (item.kind === "event") {
      setEditingEvent(item.event);
      setEventDialogOpen(true);
    } else if (item.kind === "task" || item.kind === "reminder") {
      setEditingTask(item.task);
      setTaskDialogOpen(true);
    }
  };

  const handleEventSubmit = (input: EventInput) =>
    editingEvent ? updateEvent(editingEvent.id, input) : createEvent(input);

  const handleDeleteEvent = async (event: CalendarEvent) => {
    if (!(await deleteEvent(event.id))) return;
    toast("Event deleted", {
      action: {
        label: "Undo",
        onClick: () =>
          createEvent({
            title: event.title,
            notes: event.notes,
            ...(event.allDay
              ? { allDay: true, startDate: event.startDate, endDate: event.endDate }
              : { allDay: false, startsAt: event.startsAt, endsAt: event.endsAt }),
          }),
      },
    });
  };

  return (
    // Fills the viewport on large screens: grid on the left, the day's agenda on the right
    <div className="grid grid-cols-1 gap-6 lg:h-full lg:min-h-0 lg:grid-cols-[1fr_20rem] lg:grid-rows-1">
      <div className="flex min-h-0 min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{title}</h1>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border">
              <Button variant="ghost" size="icon" className="size-8" onClick={() => goToMonth(shiftMonth(month, -1))} aria-label="Previous month">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8" onClick={() => goToMonth(today.slice(0, 8) + "01")}>
                Today
              </Button>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => goToMonth(shiftMonth(month, 1))} aria-label="Next month">
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <Button onClick={openNewEvent}>
              <Plus className="size-4 mr-1" /> New Event
            </Button>
          </div>
        </div>

        {guessed && (
          <p className="text-xs text-muted-foreground">
            {countries.length > 0
              ? `Showing ${countries.join(", ")} holidays based on your browser.`
              : "No public holidays shown."}{" "}
            <Link href="/settings" className="text-leaf underline-offset-2 hover:underline">
              Choose holiday countries
            </Link>
          </p>
        )}

        <MonthGrid
          month={month}
          days={days}
          items={items}
          today={today}
          selected={selected}
          onSelect={selectDay}
        />
      </div>

      <DayAgenda
        day={selected}
        items={items.get(selected) ?? []}
        onOpen={openItem}
        onNewEvent={openNewEvent}
      />

      <EventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        event={editingEvent}
        defaultDate={selected}
        onSubmit={handleEventSubmit}
        onDelete={handleDeleteEvent}
      />
      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        task={editingTask}
        onSubmit={(input) => updateTask(editingTask!.id, input)}
      />
    </div>
  );
}
