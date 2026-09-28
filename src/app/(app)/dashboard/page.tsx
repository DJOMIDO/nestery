// src/app/(app)/dashboard/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { WelcomeCard } from "@/components/dashboard/WelcomeCard";
import { TodayCard } from "@/components/dashboard/TodayCard";
import { ReminderCard } from "@/components/dashboard/ReminderCard";
import { OverviewCard } from "@/components/dashboard/OverviewCard";
import { QuickActionCard } from "@/components/dashboard/QuickActionCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { DeadlinesCard } from "@/components/dashboard/DeadlinesCard";
import { WeekCard } from "@/components/dashboard/WeekCard";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { EventDialog } from "@/components/calendar/EventDialog";
import { useTasks } from "@/hooks/useTasks";
import { useNotes } from "@/hooks/useNotes";
import { useEvents } from "@/hooks/useEvents";
import { toDateKey } from "@/lib/tasks";
import { noteHref } from "@/lib/notes";

export default function DashboardPage() {
  const router = useRouter();
  const { tasks, createTask } = useTasks();
  const { notes, createNote } = useNotes();
  const [today] = useState(() => toDateKey(new Date()));
  const { events, createEvent } = useEvents(today, today);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [isNewEventOpen, setIsNewEventOpen] = useState(false);

  // Create the note here and open it straight in the editor
  const handleAddNote = async () => {
    const note = await createNote();
    if (note) router.push(`${noteHref(note.id)}&new=1`);
  };

  return (
    // On large screens the dashboard fits the viewport; cards scroll inside
    <div className="space-y-6 p-2 lg:h-full lg:flex lg:flex-col lg:space-y-0 lg:gap-6">
      {/* Top row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:shrink-0">
        <WelcomeCard />
        <TodayCard tasks={tasks} events={events} />
        <ReminderCard tasks={tasks} />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:flex-1 lg:min-h-0 lg:grid-rows-1">
        <OverviewCard tasks={tasks} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:col-span-2 lg:grid-rows-2 lg:min-h-0">
          <QuickActionCard
            onAddTask={() => setIsNewTaskOpen(true)}
            onAddNote={handleAddNote}
            onAddEvent={() => setIsNewEventOpen(true)}
          />
          <RecentActivityCard tasks={tasks} notes={notes} />
          <DeadlinesCard tasks={tasks} />
          <WeekCard tasks={tasks} />
        </div>
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
        onSubmit={createEvent}
      />
    </div>
  );
}
