// src/components/dashboard/RecentActivityCard.tsx

"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { CardHeading } from "./CardHeading";
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  NotebookPen,
  PencilLine,
  type LucideIcon,
} from "lucide-react";
import { formatRelative, taskActivity, type Task } from "@/lib/tasks";
import { noteActivity, noteHref, type Note } from "@/lib/notes";
import { useFormat } from "@/components/SettingsProvider";

const MAX_ITEMS = 10;

interface ActivityRow {
  id: string;
  label: string;
  at: string;
  href: string;
  icon: LucideIcon;
  iconClass: string;
  chipClass: string;
}

// Tasks and notes events merged, newest first
function recentActivity(tasks: Task[], notes: Note[]): ActivityRow[] {
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
  return [...taskRows, ...noteRows]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, MAX_ITEMS);
}

// Recent task and note activity
export function RecentActivityCard({ tasks, notes }: { tasks: Task[]; notes: Note[] }) {
  const activities = recentActivity(tasks, notes);
  const format = useFormat();

  return (
    <Card className="w-full h-full rounded-lg shadow-sm bg-card hover:shadow-md">
      <CardContent className="p-4 flex flex-col min-h-0 flex-1">
        <CardHeading title="Recent Activity" icon={Activity} />
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
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
