// src/components/dashboard/WelcomeCard.tsx

"use client";

import { CalendarPlus, ClipboardList, NotebookPen, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrentUserName } from "@/lib/useCurrentUserName";
import { NatureGrid } from "@/components/brand/NatureShapes";
import { AtAGlance } from "./AtAGlance";
import { Skeleton } from "@/components/ui/skeleton";
import type { CalendarEvent } from "@/lib/calendar";
import type { Note } from "@/lib/notes";
import type { Task } from "@/lib/tasks";
import type { Journey } from "@/lib/travel";
import { cn } from "@/lib/utils";

// Translucent whites read on the green gradient in both themes
const PATTERN_COLORS = [
  "rgb(255 255 255 / 0.22)",
  "rgb(255 255 255 / 0.14)",
  "rgb(255 255 255 / 0.08)",
];

export interface DaySummary {
  events: number;
  tasksDue: number;
  // The next timed event still to start today, e.g. { title: "Algo", time: "10:00" }
  next?: { title: string; time: string };
}

interface WelcomeCardProps {
  summary: DaySummary;
  onAddTask: () => void;
  onAddNote: () => void;
  onAddEvent: () => void;
  // For At a glance, below the greeting
  tasks: Task[];
  notes: Note[];
  events: CalendarEvent[];
  journeys: Journey[];
  today: string;
  // The day's tasks and events are still on their way
  loading?: boolean;
  className?: string;
}

// "2 events · 3 tasks due · next: Algo at 10:00", or a calm fallback
function describeDay({ events, tasksDue, next }: DaySummary) {
  const parts = [
    events > 0 && `${events} ${events === 1 ? "event" : "events"}`,
    tasksDue > 0 && `${tasksDue} ${tasksDue === 1 ? "task" : "tasks"} due`,
    next && `next: ${next.title} at ${next.time}`,
  ].filter(Boolean);
  return parts.length > 0 ? `Today: ${parts.join(" · ")}` : "Nothing planned today. Enjoy the calm.";
}

// The greeting on the forest gradient, with At a glance below it on the plain card
export function WelcomeCard({
  summary,
  onAddTask,
  onAddNote,
  onAddEvent,
  tasks,
  notes,
  events,
  journeys,
  today,
  loading,
  className,
}: WelcomeCardProps) {
  const name = useCurrentUserName();

  return (
    <Card
      className={cn(
        "w-full h-full gap-0 py-0 overflow-hidden rounded-lg",
        className
      )}
    >
      <div className="relative shrink-0 text-white bg-gradient-to-r from-forest to-moss">
        {/* Shapes on the right, fading out toward the greeting */}
        <div className="absolute inset-y-0 right-0 w-3/5 [mask-image:linear-gradient(to_right,transparent,black_70%)]">
          <NatureGrid seed={5} cols={4} rows={2} colors={PATTERN_COLORS} />
        </div>
        <div className="relative px-4 py-6">
          <h2 className="text-2xl md:text-3xl font-semibold">Hello, {name}!</h2>
          {loading ? (
            <Skeleton className="appear-late mt-2 mb-0.5 h-3.5 w-56 max-w-full bg-white/25" />
          ) : (
            <p className="mt-1 text-sm font-medium text-white/90">{describeDay(summary)}</p>
          )}
          {/* Quick add, formerly its own card */}
          <div className="mt-3 flex flex-wrap gap-2">
            <QuickAdd icon={ClipboardList} label="Task" onClick={onAddTask} />
            <QuickAdd icon={NotebookPen} label="Note" onClick={onAddNote} />
            <QuickAdd icon={CalendarPlus} label="Event" onClick={onAddEvent} />
          </div>
        </div>
      </div>
      {/* Scrolls on its own while the greeting stays put */}
      <CardContent className="p-4 flex flex-col min-h-0 flex-1 overflow-y-auto">
        <AtAGlance tasks={tasks} notes={notes} events={events} journeys={journeys} today={today} loading={loading} />
      </CardContent>
    </Card>
  );
}

function QuickAdd({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`New ${label.toLowerCase()}`}
      className="flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-medium text-white outline-none transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/70"
    >
      <Icon className="size-3.5" /> {label}
    </button>
  );
}
