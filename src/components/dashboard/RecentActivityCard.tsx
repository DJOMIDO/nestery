// src/components/dashboard/RecentActivityCard.tsx

"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { CardHeading } from "./CardHeading";
import {
  Activity,
  CalendarCog,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  NotebookPen,
  PencilLine,
  type LucideIcon,
} from "lucide-react";
import { formatRelative, taskActivity, type Task } from "@/lib/tasks";
import { noteActivity, noteHref, type Note } from "@/lib/notes";
import { eventActivity, type CalendarEvent } from "@/lib/calendar";
import { SUBSCRIPTION_COLORS } from "@/lib/subscriptions";
import { useFormat } from "@/components/SettingsProvider";
import { ListSkeleton } from "@/components/ui/skeleton";

const MAX_ITEMS = 10;
// Older activity drops off, like the dashboard's other 7-day views
const WINDOW_DAYS = 7;
const WINDOW_MS = WINDOW_DAYS * 86_400_000;

interface ActivityRow {
  id: string;
  label: string;
  at: string;
  href: string;
  icon: LucideIcon;
  iconClass: string;
  chipClass: string;
}

// Tasks, notes and events activity of the last 7 days merged, newest first.
// Each tool has its own tone: tasks leaf, notes bark, events sky.
function recentActivity(tasks: Task[], notes: Note[], events: CalendarEvent[]): ActivityRow[] {
  const taskRows = taskActivity(tasks, MAX_ITEMS).map((a) => ({
    id: `task-${a.id}`,
    label: `${a.kind === "completed" ? "Completed" : "Created"} '${a.title}'`,
    at: a.at,
    href: "/tasks",
    icon: a.kind === "completed" ? CheckCircle2 : ClipboardList,
    iconClass: a.kind === "completed" ? "text-leaf" : "text-bark",
    chipClass: "bg-leaf-soft text-leaf",
  }));
  const noteRows = noteActivity(notes, MAX_ITEMS).map((a) => ({
    id: `note-${a.id}`,
    label: `${a.kind === "edited" ? "Edited note" : "New note"} '${a.title}'`,
    at: a.at,
    href: noteHref(a.noteId),
    icon: a.kind === "edited" ? PencilLine : NotebookPen,
    iconClass: "text-bark",
    chipClass: "bg-bark-soft text-bark",
  }));
  const eventRows = eventActivity(events, MAX_ITEMS).map((a) => ({
    id: `event-${a.id}`,
    label: `${a.kind === "edited" ? "Edited event" : "Added event"} '${a.title}'`,
    at: a.at,
    href: "/calendar",
    icon: a.kind === "edited" ? CalendarCog : CalendarPlus,
    iconClass: "text-sky-600 dark:text-sky-400",
    chipClass: SUBSCRIPTION_COLORS.sky.chip,
  }));
  const since = Date.now() - WINDOW_MS;
  return [...taskRows, ...noteRows, ...eventRows]
    .filter((row) => Date.parse(row.at) >= since)
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, MAX_ITEMS);
}

// Recent activity across tasks, notes and events. `events` are the user's own
// most recently changed events (not occurrences or subscriptions).
export function RecentActivityCard({
  tasks,
  notes,
  events,
  loading,
}: {
  tasks: Task[];
  notes: Note[];
  events: CalendarEvent[];
  // Tasks and notes still on their way
  loading?: boolean;
}) {
  const activities = recentActivity(tasks, notes, events);
  const format = useFormat();

  return (
    <Card className="w-full h-full rounded-lg bg-card">
      <CardContent className="p-4 flex flex-col min-h-0 flex-1">
        <CardHeading title="Recent Activity" icon={Activity} />
        {loading ? (
          // Fits the card like the list it stands in for; rows that don't fit are cut off
          <ListSkeleton
            label="Loading activity"
            icon
            rows={4}
            className="min-h-0 overflow-hidden"
            rowClassName="px-2 py-2"
          />
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing in the last {WINDOW_DAYS} days.</p>
        ) : (
          <ul className="space-y-0.5 min-h-0 overflow-y-auto">
            {activities.map(({ id, label, at, href, icon: Icon, iconClass, chipClass }) => (
              <li
                key={id}
                className="flex justify-between items-start p-2 hover:bg-muted border-l-4 border-transparent hover:border-leaf"
              >
                <Link
                  href={href}
                  className="flex items-center space-x-2 flex-1 min-w-0 hover:text-primary hover:underline"
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${iconClass}`} />
                  <span
                    className={`inline-block ${chipClass} px-2 py-1 rounded text-sm font-medium truncate whitespace-nowrap overflow-hidden`}
                  >
                    {label}
                  </span>
                </Link>
                <span className="pl-2 text-xs text-muted-foreground whitespace-nowrap">
                  {formatRelative(at, undefined, format.day)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
