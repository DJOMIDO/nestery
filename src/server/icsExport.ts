// src/server/icsExport.ts
// The user's calendar as an iCalendar feed for other apps: their own events
// (repeating ones expanded, see below), the due dates of open tasks and their
// journeys from Travel.

import ICAL from "ical.js";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { events, journeys, tasks } from "@/db/schema";
import { occurrenceDates, parseRRule } from "@/lib/recurrence";
import { addDays } from "@/lib/tasks";
import { journeyTimes, journeyTitle } from "@/lib/travel";
import { dateKeyIn, wallTimeIn, wallTimeToDate } from "@/server/timeZones";

// Repeating events are written out as single events over this window rather
// than as RRULE + EXDATE: an EXDATE has to match an occurrence to the second,
// which breaks across DST changes in some apps, and a removed occurrence
// would reappear. Single events show correctly everywhere.
const MONTHS_BACK = 6;
const MONTHS_AHEAD = 18;

type EventRow = typeof events.$inferSelect;

interface Occurrence {
  uid: string;
  title: string;
  notes: string | null;
  allDay: boolean;
  start: Date | string; // Date for timed events, YYYY-MM-DD for all-day
  end: Date | string; // exclusive for timed, inclusive YYYY-MM-DD for all-day
}

function shiftMonths(dateKey: string, months: number) {
  const [y, m] = dateKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

// One event, or the occurrences of a series within from..to, in `timeZone`
function occurrencesOf(event: EventRow, from: string, to: string, timeZone: string): Occurrence[] {
  const base = { title: event.title, notes: event.notes, allDay: event.allDay };
  const rule = event.rrule ? parseRRule(event.rrule) : null;

  if (!rule) {
    return [
      {
        ...base,
        uid: `${event.id}@nestery`,
        start: event.allDay ? event.startDate! : event.startsAt!,
        end: event.allDay ? event.endDate! : event.endsAt!,
      },
    ];
  }

  // The series' first day and wall-clock time in the user's zone
  const first = event.allDay ? event.startDate! : dateKeyIn(event.startsAt!, timeZone);
  const span = event.allDay ? dayDiff(event.startDate!, event.endDate!) : 0;
  const clock = event.allDay ? null : wallTimeIn(event.startsAt!, timeZone);
  const duration = event.allDay ? 0 : event.endsAt!.getTime() - event.startsAt!.getTime();

  return occurrenceDates(first, rule, addDays(from, -span), to, event.exdates).map((date) => {
    const uid = `${event.id}-${date}@nestery`;
    if (event.allDay) return { ...base, uid, start: date, end: addDays(date, span) };
    const [year, month, day] = date.split("-").map(Number);
    // Same wall-clock time on each day, so 09:00 stays 09:00 across DST changes
    const start = wallTimeToDate({ ...clock!, year, month, day }, timeZone);
    return { ...base, uid, start, end: new Date(start.getTime() + duration) };
  });
}

const dateValue = (dateKey: string) => ICAL.Time.fromDateString(dateKey);
const utcValue = (date: Date) => ICAL.Time.fromJSDate(date, true);

function toVevent(occurrence: Occurrence, stamp: ICAL.Time) {
  const vevent = new ICAL.Component("vevent");
  vevent.addPropertyWithValue("uid", occurrence.uid);
  vevent.addPropertyWithValue("dtstamp", stamp);
  vevent.addPropertyWithValue("summary", occurrence.title);
  if (occurrence.notes) vevent.addPropertyWithValue("description", occurrence.notes);
  if (occurrence.allDay) {
    vevent.addPropertyWithValue("dtstart", dateValue(occurrence.start as string));
    // DTEND of an all-day event is the day after the last one
    vevent.addPropertyWithValue("dtend", dateValue(addDays(occurrence.end as string, 1)));
  } else {
    vevent.addPropertyWithValue("dtstart", utcValue(occurrence.start as Date));
    vevent.addPropertyWithValue("dtend", utcValue(occurrence.end as Date));
  }
  return vevent;
}

type TaskRow = { id: string; title: string; description: string | null; dueDate: string | null };
type JourneyRow = typeof journeys.$inferSelect;

export async function buildFeed(userId: string, timeZone: string, now = new Date()) {
  const [eventRows, taskRows, journeyRows] = await Promise.all([
    db.select().from(events).where(eq(events.userId, userId)),
    db
      .select({ id: tasks.id, title: tasks.title, description: tasks.description, dueDate: tasks.dueDate })
      .from(tasks)
      .where(and(eq(tasks.userId, userId), ne(tasks.status, "done"), isNotNull(tasks.dueDate))),
    db.select().from(journeys).where(eq(journeys.userId, userId)),
  ]);
  return feedFromRows(eventRows, taskRows, timeZone, now, journeyRows);
}

// Rows -> iCalendar text (separate from the queries so it can be tested alone)
export function feedFromRows(
  eventRows: EventRow[],
  taskRows: TaskRow[],
  timeZone: string,
  now = new Date(),
  journeyRows: JourneyRow[] = []
) {
  const today = dateKeyIn(now, timeZone);
  const from = shiftMonths(today, -MONTHS_BACK);
  const to = shiftMonths(today, MONTHS_AHEAD);

  const occurrences: Occurrence[] = [];
  for (const event of eventRows) {
    for (const occ of occurrencesOf(event, from, to, timeZone)) {
      const startDay = typeof occ.start === "string" ? occ.start : dateKeyIn(occ.start, timeZone);
      // Single events outside the window are left out too, keeping the feed small
      if (startDay <= to && (typeof occ.end === "string" ? occ.end : dateKeyIn(occ.end, timeZone)) >= from) {
        occurrences.push(occ);
      }
    }
  }
  for (const task of taskRows) {
    if (task.dueDate! < from || task.dueDate! > to) continue;
    occurrences.push({
      uid: `task-${task.id}@nestery`,
      title: `Due: ${task.title}`,
      notes: task.description,
      allDay: true,
      start: task.dueDate!,
      end: task.dueDate!,
    });
  }

  for (const journey of journeyRows) {
    if (journey.departureDate < from || journey.departureDate > to) continue;
    // Ends without a time zone (trains, unknown airports) are on the user's clock
    const times = journeyTimes(journey, timeZone);
    occurrences.push({
      uid: `journey-${journey.id}@nestery`,
      title: journeyTitle(journey),
      notes: [journey.seat && `Seat ${journey.seat}`, journey.bookingRef && `Booking ${journey.bookingRef}`, journey.notes]
        .filter(Boolean)
        .join("\n") || null,
      allDay: !times,
      start: times?.start ?? journey.departureDate,
      end: times?.end ?? journey.arrivalDate ?? journey.departureDate,
    });
  }

  const calendar = new ICAL.Component("vcalendar");
  calendar.addPropertyWithValue("version", "2.0");
  calendar.addPropertyWithValue("prodid", "-//Nestery//Calendar//EN");
  calendar.addPropertyWithValue("calscale", "GREGORIAN");
  calendar.addPropertyWithValue("x-wr-calname", "Nestery");
  calendar.addPropertyWithValue("x-wr-timezone", timeZone);
  // Hint to apps: check back about every hour
  calendar.addPropertyWithValue("refresh-interval", ICAL.Duration.fromString("PT1H"));
  calendar.addPropertyWithValue("x-published-ttl", "PT1H");

  const stamp = utcValue(now);
  for (const occurrence of occurrences) calendar.addSubcomponent(toVevent(occurrence, stamp));
  return calendar.toString();
}
