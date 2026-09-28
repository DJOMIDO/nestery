// src/lib/calendar.ts
// Calendar types and date helpers shared by the server, the calendar page and
// the dashboard. Keep this file free of server-only imports.

import { addDays, startOfWeek, toDateKey, type Task } from "@/lib/tasks";

// An event as returned by /api/events. Timed events have startsAt/endsAt;
// all-day events have startDate/endDate (YYYY-MM-DD, end inclusive).
export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  notes: string | null;
  allDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Holiday {
  date: string; // YYYY-MM-DD
  localName: string;
  name: string;
  countryCode: string;
}

export type CalendarItem =
  | { kind: "event"; id: string; event: CalendarEvent; time: string | null }
  | { kind: "task"; id: string; task: Task }
  | { kind: "reminder"; id: string; task: Task; time: string }
  | { kind: "holiday"; id: string; holiday: Holiday };

export const MAX_HOLIDAY_COUNTRIES = 3;

// Six weeks of days covering the month that contains `month`
export function monthGrid(month: string, weekStart: 0 | 1 = 1) {
  const start = startOfWeek(month.slice(0, 8) + "01", weekStart);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export const monthKey = (dateKey: string) => dateKey.slice(0, 7);

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return toDateKey(new Date(y, m - 1 + delta, 1));
}

// Local calendar days an event covers (inclusive)
export function eventDays(event: CalendarEvent): { first: string; last: string } {
  if (event.allDay) return { first: event.startDate!, last: event.endDate! };
  const start = new Date(event.startsAt!);
  // An event ending exactly at midnight does not spill into the next day
  const end = new Date(new Date(event.endsAt!).getTime() - 1);
  return { first: toDateKey(start), last: toDateKey(end < start ? start : end) };
}

// Items for each day in `days`: all-day items first (holidays, all-day events,
// tasks due), then timed ones by time
export function itemsByDay(
  days: string[],
  { events, tasks, holidays }: { events: CalendarEvent[]; tasks: Task[]; holidays: Holiday[] }
) {
  const map = new Map<string, CalendarItem[]>(days.map((d) => [d, []]));
  const add = (day: string, item: CalendarItem) => map.get(day)?.push(item);

  for (const holiday of holidays) {
    add(holiday.date, { kind: "holiday", id: `h-${holiday.countryCode}-${holiday.date}-${holiday.name}`, holiday });
  }
  for (const event of events) {
    const { first, last } = eventDays(event);
    for (let day = first; day <= last; day = addDays(day, 1)) {
      if (!map.has(day)) {
        if (day > days[days.length - 1]) break;
        continue;
      }
      // Timed events show their start time on the first day only
      const time = !event.allDay && day === first ? event.startsAt : null;
      add(day, { kind: "event", id: `e-${event.id}-${day}`, event, time });
    }
  }
  for (const task of tasks) {
    if (task.dueDate) add(task.dueDate, { kind: "task", id: `t-${task.id}`, task });
    if (task.remindAt && task.status !== "done") {
      add(toDateKey(new Date(task.remindAt)), {
        kind: "reminder",
        id: `r-${task.id}`,
        task,
        time: task.remindAt,
      });
    }
  }

  const rank: Record<CalendarItem["kind"], number> = { holiday: 0, event: 1, task: 2, reminder: 3 };
  const timeOf = (item: CalendarItem) =>
    item.kind === "event" || item.kind === "reminder" ? item.time ?? "" : "";
  for (const items of map.values()) {
    items.sort((a, b) => {
      const ta = timeOf(a);
      const tb = timeOf(b);
      // Untimed items first, then by time, then by kind
      if (!ta !== !tb) return ta ? 1 : -1;
      if (ta !== tb) return ta < tb ? -1 : 1;
      return rank[a.kind] - rank[b.kind];
    });
  }
  return map;
}

// Guess holiday countries from the browser languages ("fr-FR" -> "FR");
// empty when no language carries a region
export function guessHolidayCountries(languages: readonly string[]) {
  for (const lang of languages) {
    const region = lang.split("-").find((part, i) => i > 0 && /^[A-Za-z]{2}$/.test(part));
    if (region) return [region.toUpperCase()];
  }
  return [];
}
