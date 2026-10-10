// src/components/calendar/CalendarItemView.tsx
"use client";

import { Bell, CalendarClock, CheckCircle2, Circle, PartyPopper, Repeat } from "lucide-react";
import { useFormat } from "@/components/SettingsProvider";
import { eventDays, type CalendarEvent, type CalendarItem } from "@/lib/calendar";
import type { Formatter } from "@/lib/format";
import { describeRule, parseRRule } from "@/lib/recurrence";
import { SUBSCRIPTION_COLORS } from "@/lib/subscriptions";
import { journeyIcon } from "@/components/travel/journeyIcon";
import { toDateKey } from "@/lib/tasks";
import { cn } from "@/lib/utils";

// "All day", "Oct 1 – Oct 3", "09:00 – 10:00" or "Oct 1 09:00 – Oct 2 11:00"
export function eventWhen(event: CalendarEvent, format: Formatter) {
  const { first, last } = eventDays(event);
  if (event.allDay) return first === last ? "All day" : `${format.day(first)} – ${format.day(last)}`;
  const start = format.time(event.startsAt!);
  const end = format.time(event.endsAt!);
  return first === last ? `${start} – ${end}` : `${format.day(first)} ${start} – ${format.day(last)} ${end}`;
}

// Short text for a grid chip
function chipLabel(item: CalendarItem, format: Formatter) {
  switch (item.kind) {
    case "event":
      return item.time ? `${format.time(item.time)} ${item.event.title}` : item.event.title;
    case "holiday":
      return `${item.holiday.countryCode} · ${item.holiday.localName}`;
    case "task":
      return item.task.title;
    case "reminder":
      return `${format.time(item.time)} ${item.task.title}`;
  }
}

const isOverdue = (item: CalendarItem) =>
  item.kind === "task" &&
  item.task.status !== "done" &&
  item.task.dueDate! < toDateKey(new Date());

// Background/text per kind, shared by chips and dots
export const itemTone: Record<CalendarItem["kind"], string> = {
  event: "bg-leaf-soft text-leaf",
  holiday: "bg-bark-soft text-bark",
  task: "bg-muted text-foreground",
  reminder: "text-muted-foreground",
};

export const itemDot: Record<CalendarItem["kind"], string> = {
  event: "bg-leaf",
  holiday: "bg-bark",
  task: "bg-muted-foreground",
  reminder: "bg-moss",
};

// Subscribed-calendar events take their calendar's color
export const toneOf = (item: CalendarItem) =>
  item.kind === "event" && item.event.source
    ? SUBSCRIPTION_COLORS[item.event.source.color].chip
    : itemTone[item.kind];

export const dotOf = (item: CalendarItem) =>
  item.kind === "event" && item.event.source
    ? SUBSCRIPTION_COLORS[item.event.source.color].dot
    : itemDot[item.kind];

// One-line chip for a month grid cell
export function CalendarChip({ item }: { item: CalendarItem }) {
  const format = useFormat();
  const label = chipLabel(item, format);
  const done = item.kind === "task" && item.task.status === "done";
  return (
    <span
      className={cn(
        "flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] leading-tight",
        toneOf(item),
        done && "line-through opacity-60",
        isOverdue(item) && "text-rose-600"
      )}
      title={label}
    >
      {item.kind === "reminder" && <Bell className="size-3 shrink-0" />}
      {item.kind === "event" && <EventKindIcon event={item.event} className="size-3 shrink-0" />}
      <span className="truncate">{label}</span>
      {item.kind === "event" && item.event.rrule && (
        <Repeat className="ml-auto size-3 shrink-0 opacity-70" aria-label="Repeats" />
      )}
    </span>
  );
}

// A plane or train before a journey's title; nothing for other events
export function EventKindIcon({ event, className }: { event: CalendarEvent; className?: string }) {
  const kind = event.source?.journeyKind;
  if (!kind) return null;
  const Icon = journeyIcon(kind);
  return <Icon className={className} />;
}

// Full row for the day agenda
export function CalendarRow({ item }: { item: CalendarItem }) {
  const { icon: Icon, title, detail } = rowContent(item, useFormat());
  const done = item.kind === "task" && item.task.status === "done";
  return (
    <div className="flex items-start gap-3">
      <span className={cn("mt-0.5 rounded-md p-1.5", toneOf(item), item.kind === "reminder" && "bg-muted")}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("flex items-center gap-1.5 text-sm font-medium break-words", done && "line-through text-muted-foreground")}>
          {title}
          {item.kind === "event" && item.event.rrule && (
            <Repeat className="size-3.5 shrink-0 text-muted-foreground" aria-label="Repeats" />
          )}
        </p>
        <p className={cn("line-clamp-2 text-xs text-muted-foreground wrap-anywhere", isOverdue(item) && "text-rose-600")}>
          {detail}
        </p>
      </div>
    </div>
  );
}

function rowContent(item: CalendarItem, format: Formatter) {
  switch (item.kind) {
    case "event":
      return {
        icon: item.event.source?.journeyKind ? journeyIcon(item.event.source.journeyKind) : CalendarClock,
        title: item.event.title,
        detail: [
          eventWhen(item.event, format),
          repeatText(item.event, format),
          item.event.source?.location,
          item.event.source?.name,
          item.event.source ? null : firstLine(item.event.notes),
        ]
          .filter(Boolean)
          .join(" · "),
      };
    case "holiday":
      return {
        icon: PartyPopper,
        title: item.holiday.localName,
        detail:
          item.holiday.name !== item.holiday.localName
            ? `${item.holiday.name} · ${item.holiday.countryCode}`
            : `Public holiday · ${item.holiday.countryCode}`,
      };
    case "task":
      return {
        icon: item.task.status === "done" ? CheckCircle2 : Circle,
        title: item.task.title,
        detail: item.task.status === "done" ? "Task completed" : isOverdue(item) ? "Task overdue" : "Task due",
      };
    case "reminder":
      return { icon: Bell, title: item.task.title, detail: `Reminder at ${format.time(item.time)}` };
  }
}

// A row shows only the first non-blank line of the notes; imported (ICS)
// notes can be long blocks of links that belong in the event dialog
function firstLine(notes: string | null | undefined) {
  return notes?.split("\n").map((line) => line.replace(/\s+/g, " ").trim()).find(Boolean) ?? null;
}

// "Every week on Mon", or null for events that do not repeat
function repeatText(event: CalendarEvent, format: Formatter) {
  const rule = event.rrule ? parseRRule(event.rrule) : null;
  if (!rule) return null;
  return describeRule(rule, {
    weekdayName: (d) => format.weekday(new Date(2024, 0, 7 + d)),
    formatDay: format.dayWithYear,
  });
}
