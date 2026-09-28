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

// ---------------------------------------------------------------------------
// Week view: time layout, moving and resizing
// ---------------------------------------------------------------------------

export const DAY_MINUTES = 24 * 60;
// Drag and resize snap to quarter hours; shorter events still get this much room
export const SNAP_MINUTES = 15;

// Seven days starting on the week start, for the week containing `day`
export function weekDays(day: string, weekStart: 0 | 1 = 1) {
  const start = startOfWeek(day, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

// Whole days from `from` to `to` (both YYYY-MM-DD), unaffected by DST
export function dayDiff(from: string, to: string) {
  const utc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

export const snapMinutes = (minutes: number) =>
  Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;

// Minutes since local midnight, by the wall clock
const clockMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes();

export interface TimedSegment {
  event: CalendarEvent;
  day: string;
  // Minutes from local midnight, clipped to the day
  start: number;
  end: number;
  // Side-by-side placement among overlapping events
  column: number;
  columns: number;
}

// Timed events cut into one segment per day they touch, laid out so events
// that overlap in time sit side by side
export function timedSegments(events: CalendarEvent[], days: string[]) {
  const byDay = new Map<string, TimedSegment[]>(days.map((d) => [d, []]));
  for (const event of events) {
    if (event.allDay) continue;
    const startsAt = new Date(event.startsAt!);
    const endsAt = new Date(event.endsAt!);
    const { first, last } = eventDays(event);
    for (const day of days) {
      if (day < first || day > last) continue;
      const start = day === first ? clockMinutes(startsAt) : 0;
      // Ending at midnight counts as the end of the previous day
      const end = day === toDateKey(endsAt) ? clockMinutes(endsAt) : DAY_MINUTES;
      byDay.get(day)!.push({ event, day, start, end: Math.max(end, start), column: 0, columns: 1 });
    }
  }
  for (const segments of byDay.values()) layoutOverlaps(segments);
  return byDay;
}

// Greedy column layout: each group of mutually overlapping events shares its
// width equally, and each event takes the first column that is free
function layoutOverlaps(segments: TimedSegment[]) {
  // Very short events still occupy a visible block, so they count as that long
  const visibleEnd = (s: TimedSegment) => Math.max(s.end, s.start + SNAP_MINUTES);
  segments.sort((a, b) => a.start - b.start || visibleEnd(b) - visibleEnd(a));

  let group: TimedSegment[] = [];
  let columnEnds: number[] = [];
  let groupEnd = -1;
  const closeGroup = () => {
    for (const s of group) s.columns = columnEnds.length;
    group = [];
    columnEnds = [];
  };

  for (const segment of segments) {
    if (segment.start >= groupEnd) closeGroup();
    let column = columnEnds.findIndex((end) => end <= segment.start);
    if (column === -1) column = columnEnds.push(0) - 1;
    columnEnds[column] = visibleEnd(segment);
    segment.column = column;
    group.push(segment);
    groupEnd = Math.max(groupEnd, visibleEnd(segment));
  }
  closeGroup();
}

// Same wall-clock time `days` later (so 09:00 stays 09:00 across DST changes)
export function shiftDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d;
}

// New timing after moving an event by whole days and, for timed events,
// by minutes. Timed events keep their duration.
export function movedTiming(event: CalendarEvent, days: number, minutes = 0) {
  if (event.allDay) {
    return {
      allDay: true as const,
      startDate: addDays(event.startDate!, days),
      endDate: addDays(event.endDate!, days),
    };
  }
  const start = shiftDays(event.startsAt!, days);
  start.setMinutes(start.getMinutes() + minutes);
  const duration = Date.parse(event.endsAt!) - Date.parse(event.startsAt!);
  return {
    allDay: false as const,
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + duration).toISOString(),
  };
}

// New timing after dragging a timed event's end by `minutes`; it never gets
// shorter than one snap step
export function resizedTiming(event: CalendarEvent, minutes: number) {
  const start = Date.parse(event.startsAt!);
  const end = new Date(event.endsAt!);
  end.setMinutes(end.getMinutes() + minutes);
  const minEnd = start + SNAP_MINUTES * 60_000;
  return {
    allDay: false as const,
    startsAt: event.startsAt!,
    endsAt: new Date(Math.max(end.getTime(), minEnd)).toISOString(),
  };
}
