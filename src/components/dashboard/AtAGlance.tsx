// src/components/dashboard/AtAGlance.tsx

"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, LayoutGrid, ListTodo, NotebookPen, Plane, type LucideIcon } from "lucide-react";
import { CardHeading } from "./CardHeading";
import { useFormat } from "@/components/SettingsProvider";
import { eventDays, type CalendarEvent } from "@/lib/calendar";
import type { Note } from "@/lib/notes";
import { addDays, tagCounts, type Task } from "@/lib/tasks";
import { journeyLabel, type Journey } from "@/lib/travel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;
const MAX_TAGS = 6;

interface AtAGlanceProps {
  tasks: Task[];
  notes: Note[];
  // Events (own, subscribed and journeys) of the next 7 days, today first
  events: CalendarEvent[];
  journeys: Journey[];
  today: string;
  // The data is still on its way: rows show placeholders for their numbers
  loading?: boolean;
}

// One line per tool, with the numbers that matter over the next / last 7 days.
// Rendered inside the Welcome card, below the greeting.
export function AtAGlance({ tasks, notes, events, journeys, today, loading }: AtAGlanceProps) {
  const format = useFormat();
  const lastDay = addDays(today, 6);
  const now = Date.now();

  const open = tasks.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today).length;
  const dueSoon = open.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= lastDay).length;

  const pinned = notes.filter((n) => n.pinned).length;
  const editedRecently = notes.filter((n) => now - Date.parse(n.updatedAt) < 7 * DAY_MS).length;

  // Journeys have their own row
  const upcoming = events.filter((e) => {
    const { first, last } = eventDays(e);
    return !e.source?.journeyId && last >= today && first <= lastDay;
  });

  const upcomingTrips = journeys
    .filter((j) => j.departureDate >= today)
    .sort((a, b) => `${a.departureDate}${a.departureTime ?? ""}`.localeCompare(`${b.departureDate}${b.departureTime ?? ""}`));
  const nextTrip = upcomingTrips[0];
  // The next thing on the calendar: a timed event that hasn't started, or an
  // all-day event from today on
  const next = upcoming
    .filter((e) => (e.allDay ? eventDays(e).first >= today : Date.parse(e.startsAt!) > now))
    .sort((a, b) => (a.startsAt ?? `${a.startDate}T00`).localeCompare(b.startsAt ?? `${b.startDate}T00`))[0];

  const tags = tagCounts(open).slice(0, MAX_TAGS);

  return (
    <>
      <CardHeading title="At a glance" icon={LayoutGrid} />

      <ul className="divide-y">
        <GlanceRow href="/tasks" icon={ListTodo} title="Tasks" loading={loading}>
          <Stat value={open.length} label="open" />
          <Stat value={overdue} label="overdue" alert={overdue > 0} />
          <Stat value={dueSoon} label="due in 7 days" />
        </GlanceRow>
        <GlanceRow href="/notes" icon={NotebookPen} title="Notes" loading={loading}>
          <Stat value={notes.length} label={notes.length === 1 ? "note" : "notes"} />
          <Stat value={pinned} label="pinned" />
          <Stat value={editedRecently} label="edited in 7 days" />
        </GlanceRow>
        <GlanceRow href="/calendar" icon={CalendarDays} title="Calendar" loading={loading}>
          <Stat value={upcoming.length} label={`${upcoming.length === 1 ? "event" : "events"} in 7 days`} />
          {next && (
            <span className="min-w-0 truncate text-muted-foreground">
              Next: <span className="text-foreground">{next.title}</span> ·{" "}
              {next.allDay ? format.dayWithWeekday(next.startDate!) : `${format.weekday(next.startsAt!)} ${format.time(next.startsAt!)}`}
            </span>
          )}
        </GlanceRow>
        <GlanceRow href="/travel" icon={Plane} title="Travel" loading={loading}>
          <Stat value={upcomingTrips.length} label={upcomingTrips.length === 1 ? "trip ahead" : "trips ahead"} />
          {nextTrip && (
            <span className="min-w-0 truncate text-muted-foreground">
              Next:{" "}
              <span className="text-foreground">
                {journeyLabel(nextTrip)} → {nextTrip.destinationName ?? nextTrip.destinationCity ?? nextTrip.destination}
              </span>{" "}
              · {format.dayWithWeekday(nextTrip.departureDate)}
            </span>
          )}
        </GlanceRow>
      </ul>

      {!loading && tags.length > 0 && (
        <div className="mt-auto pt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Tags on open tasks</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map(({ tag, count }) => (
              <span key={tag} className="rounded bg-bark-soft px-2 py-0.5 text-xs text-bark">
                #{tag} <span className="opacity-70">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function GlanceRow({
  href,
  icon: Icon,
  title,
  loading,
  children,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link href={href} className="group flex items-start gap-3 rounded-md px-1 py-3 hover:bg-muted/60">
        <span className="rounded-md bg-leaf-soft p-1.5 text-leaf">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{title}</span>
          {loading ? (
            <Skeleton className="appear-late mt-1.5 h-3 w-2/3" />
          ) : (
            <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">{children}</span>
          )}
        </span>
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </Link>
    </li>
  );
}

function Stat({ value, label, alert }: { value: number; label: string; alert?: boolean }) {
  return (
    <span className={cn("text-muted-foreground", alert && "text-rose-600")}>
      <span className={cn("font-semibold text-foreground", alert && "text-rose-600")}>{value}</span> {label}
    </span>
  );
}
