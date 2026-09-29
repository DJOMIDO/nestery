// src/components/dashboard/WelcomeCard.tsx

"use client";

import { CalendarPlus, ClipboardList, NotebookPen, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrentUserName } from "@/lib/useCurrentUserName";
import { NatureGrid } from "@/components/brand/NatureShapes";

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

export function WelcomeCard({ summary, onAddTask, onAddNote, onAddEvent }: WelcomeCardProps) {
  const name = useCurrentUserName();

  return (
    <Card
      className={`
        relative overflow-hidden w-full rounded-lg shadow-sm
        text-white bg-gradient-to-r from-forest to-moss
        hover:shadow-md transition
      `}
    >
      {/* Shapes on the right, fading out toward the greeting */}
      <div className="absolute inset-y-0 right-0 w-3/5 [mask-image:linear-gradient(to_right,transparent,black_70%)]">
        <NatureGrid seed={5} cols={4} rows={2} colors={PATTERN_COLORS} />
      </div>
      <CardContent className="relative p-4">
        <h2 className="text-2xl md:text-3xl font-semibold">Hello, {name}!</h2>
        <p className="mt-1 text-sm font-medium text-white/90">{describeDay(summary)}</p>
        {/* Quick add, formerly its own card */}
        <div className="mt-3 flex flex-wrap gap-2">
          <QuickAdd icon={ClipboardList} label="Task" onClick={onAddTask} />
          <QuickAdd icon={NotebookPen} label="Note" onClick={onAddNote} />
          <QuickAdd icon={CalendarPlus} label="Event" onClick={onAddEvent} />
        </div>
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
