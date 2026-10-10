// src/app/(app)/dashboard/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WelcomeCard, type DaySummary } from "@/components/dashboard/WelcomeCard";
import { TodayCard } from "@/components/dashboard/TodayCard";
import { ReminderCard } from "@/components/dashboard/ReminderCard";
import { UpNextCard } from "@/components/dashboard/UpNextCard";
import { RecentNotesCard } from "@/components/dashboard/RecentNotesCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { EventDialog } from "@/components/calendar/EventDialog";
import { useFormat } from "@/components/SettingsProvider";
import { useTasks } from "@/hooks/useTasks";
import { useNotes } from "@/hooks/useNotes";
import { useEvents, type EventInput } from "@/hooks/useEvents";
import { journeyEventsBetween, useJourneys } from "@/hooks/useJourneys";
import { useSubscriptionEvents } from "@/hooks/useSubscriptions";
import { request } from "@/lib/api";
import { eventDays, type CalendarEvent } from "@/lib/calendar";
import { addDays, toDateKey } from "@/lib/tasks";
import { noteHref } from "@/lib/notes";

// The user's latest added or edited events, for Recent activity
function useRecentEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const reload = useCallback(() => {
    request<CalendarEvent[]>("/api/events/recent").then(setEvents).catch(() => setEvents([]));
  }, []);
  useEffect(reload, [reload]);
  return { events, reload };
}

export default function DashboardPage() {
  const router = useRouter();
  const format = useFormat();
  const { tasks, createTask } = useTasks();
  const { notes, createNote } = useNotes();

  // Today and the six days after it: shared by Today, Up next and Welcome's At a glance
  const [today] = useState(() => toDateKey(new Date()));
  const lastDay = addDays(today, 6);
  const { occurrences, createEvent } = useEvents(today, lastDay);
  // Subscribed calendars (e.g. a class timetable) count as well
  const subscribedEvents = useSubscriptionEvents(today, lastDay);
  // Journeys from Travel show like events in Today, Up next and At a glance
  const { journeys } = useJourneys();
  const upcomingEvents = useMemo(
    () => [...occurrences, ...subscribedEvents, ...journeyEventsBetween(journeys, today, lastDay)],
    [occurrences, subscribedEvents, journeys, today, lastDay]
  );
  const recent = useRecentEvents();

  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [isNewEventOpen, setIsNewEventOpen] = useState(false);

  const summary = useMemo<DaySummary>(() => {
    const now = Date.now();
    const todays = upcomingEvents.filter((e) => {
      const { first, last } = eventDays(e);
      return first <= today && today <= last;
    });
    const next = todays
      .filter((e) => !e.allDay && Date.parse(e.startsAt!) > now)
      .sort((a, b) => a.startsAt!.localeCompare(b.startsAt!))[0];
    return {
      events: todays.length,
      tasksDue: tasks.filter((t) => t.status !== "done" && t.dueDate === today).length,
      next: next ? { title: next.title, time: format.time(next.startsAt!) } : undefined,
    };
  }, [upcomingEvents, tasks, today, format]);

  // Create the note here and open it straight in the editor
  const handleAddNote = async () => {
    const note = await createNote();
    if (note) router.push(`${noteHref(note.id)}&new=1`);
  };

  const handleCreateEvent = async (input: EventInput) => {
    const event = await createEvent(input);
    if (event) recent.reload();
    return event;
  };

  return (
    // On large screens the dashboard fits the viewport; cards scroll inside.
    // Welcome (with At a glance) fills the first column; the others have a
    // top row (Today, Reminders) and a bottom row (Up next, Notes/Activity).
    <div className="grid grid-cols-1 gap-6 p-2 md:grid-cols-2 lg:h-full lg:grid-cols-3 lg:grid-rows-[auto_minmax(0,1fr)]">
      <WelcomeCard
        className="md:row-span-2 lg:min-h-0"
        summary={summary}
        onAddTask={() => setIsNewTaskOpen(true)}
        onAddNote={handleAddNote}
        onAddEvent={() => setIsNewEventOpen(true)}
        tasks={tasks}
        notes={notes}
        events={upcomingEvents}
        journeys={journeys}
        today={today}
      />
      <TodayCard tasks={tasks} events={upcomingEvents} />
      <ReminderCard tasks={tasks} journeys={journeys} />
      <UpNextCard tasks={tasks} events={upcomingEvents} today={today} />
      <div className="grid grid-cols-1 gap-6 lg:grid-rows-2 lg:min-h-0">
        <RecentNotesCard notes={notes} />
        <RecentActivityCard tasks={tasks} notes={notes} events={recent.events} />
      </div>

      <TaskDialog
        open={isNewTaskOpen}
        onOpenChange={setIsNewTaskOpen}
        onSubmit={createTask}
      />
      <EventDialog
        open={isNewEventOpen}
        onOpenChange={setIsNewEventOpen}
        event={null}
        defaultDate={today}
        onSubmit={handleCreateEvent}
      />
    </div>
  );
}
