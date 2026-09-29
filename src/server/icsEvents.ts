// src/server/icsEvents.ts
// Reads events out of an iCalendar feed with ical.js, expanding repeating ones
// (including exceptions) for a date range.

import ICAL from "ical.js";
import { wallTimeToDate } from "@/server/timeZones";

export interface FeedEvent {
  uid: string;
  title: string;
  notes: string | null;
  location: string | null;
  allDay: boolean;
  // Timed: ISO timestamps; all-day: YYYY-MM-DD with an inclusive end
  startsAt: string | null;
  endsAt: string | null;
  startDate: string | null;
  endDate: string | null;
}

const DAY_MS = 86_400_000;
// A feed with a runaway rule must not stall the request
const MAX_OCCURRENCES_PER_EVENT = 2000;

// ICAL.Time -> Date. Zones defined in the feed and UTC are handled by ical.js;
// a TZID the feed does not define is looked up by name; floating times are
// read in the viewer's own time zone.
function toDate(t: ICAL.Time, viewerZone: string) {
  const zone = t.zone?.tzid;
  if (zone === "UTC" || (zone && zone !== "floating")) return t.toJSDate();
  const tzid = (t as unknown as { timezone?: string }).timezone;
  return wallTimeToDate(t, tzid && tzid !== "floating" ? tzid : viewerZone);
}

const dateKey = (t: ICAL.Time) =>
  `${String(t.year).padStart(4, "0")}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;

export type IcsTiming =
  | { allDay: true; startDate: string; endDate: string; startsAt: null; endsAt: null }
  | { allDay: false; startsAt: string; endsAt: string; startDate: null; endDate: null };

// DTSTART/DTEND -> Nestery timing. All-day events get an inclusive end date
// (DTEND is exclusive in iCalendar); timed ones become instants.
export function readTiming(start: ICAL.Time, end: ICAL.Time | null, timeZone: string): IcsTiming {
  if (start.isDate) {
    const endExclusive = end && end.compare(start) > 0 ? end.clone() : start.clone();
    if (!end || end.compare(start) <= 0) endExclusive.adjust(1, 0, 0, 0);
    endExclusive.adjust(-1, 0, 0, 0);
    return { allDay: true, startDate: dateKey(start), endDate: dateKey(endExclusive), startsAt: null, endsAt: null };
  }
  const s = toDate(start, timeZone);
  const e = end ? toDate(end, timeZone) : s;
  return { allDay: false, startsAt: s.toISOString(), endsAt: (e < s ? s : e).toISOString(), startDate: null, endDate: null };
}

// The local day an ICAL.Time falls on (for EXDATE and RECURRENCE-ID)
export function localDateOf(t: ICAL.Time, timeZone: string) {
  if (t.isDate) return dateKey(t);
  const d = toDate(t, timeZone);
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function parseCalendar(ics: string) {
  const calendar = new ICAL.Component(ICAL.parse(ics));
  for (const vtimezone of calendar.getAllSubcomponents("vtimezone")) {
    ICAL.TimezoneService.register(vtimezone);
  }
  return calendar;
}

// Number of events in a feed; throws if it cannot be parsed
export function countFeedEvents(ics: string) {
  return parseCalendar(ics).getAllSubcomponents("vevent").length;
}

// Events overlapping the days from..to (YYYY-MM-DD). Like /api/events, timed
// events get a day of margin on each side; the client places them on local days.
export function feedEvents(ics: string, { from, to, timeZone }: { from: string; to: string; timeZone: string }) {
  const calendar = parseCalendar(ics);
  const rangeStart = Date.parse(from) - DAY_MS;
  const rangeEnd = Date.parse(to) + 2 * DAY_MS;

  // Series and their edited occurrences (RECURRENCE-ID) share a UID
  const series = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const component of calendar.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(component);
    if (!event.startDate) continue;
    if (event.isRecurrenceException()) {
      exceptions.push(event);
      continue;
    }
    // UIDs should be unique, but some feeds reuse them; keep every event
    let key = event.uid || `${event.summary}-${event.startDate}`;
    for (let n = 2; series.has(key); n++) key = `${event.uid}#${n}`;
    series.set(key, event);
  }
  for (const exception of exceptions) {
    const parent = series.get(exception.uid);
    if (parent) parent.relateException(exception);
    else series.set(`${exception.uid}-${exception.recurrenceId}`, exception);
  }

  const results: FeedEvent[] = [];
  const add = (item: ICAL.Event, start: ICAL.Time, end: ICAL.Time | null, uid: string) => {
    if (item.component.getFirstPropertyValue("status") === "CANCELLED") return;
    const base = {
      uid,
      title: item.summary?.trim() || "(No title)",
      notes: item.description?.trim() || null,
      location: item.location?.trim() || null,
    };
    const timing = readTiming(start, end, timeZone);
    const outside = timing.allDay
      ? timing.startDate > to || timing.endDate < from
      : Date.parse(timing.startsAt) >= rangeEnd || Date.parse(timing.endsAt) < rangeStart;
    if (!outside) results.push({ ...base, ...timing });
  };

  for (const [key, event] of series) {
    if (!event.isRecurring()) {
      add(event, event.startDate, event.endDate, key);
      continue;
    }
    const iterator = event.iterator();
    for (let i = 0; i < MAX_OCCURRENCES_PER_EVENT; i++) {
      const next = iterator.next();
      if (!next) break;
      const details = event.getOccurrenceDetails(next);
      // Occurrences start in order, so the first one past the range ends the series
      if (!details.startDate.isDate && toDate(details.startDate, timeZone).getTime() >= rangeEnd) break;
      if (details.startDate.isDate && dateKey(details.startDate) > to) break;
      add(details.item, details.startDate, details.endDate, `${key}@${next.toString()}`);
    }
  }
  return results;
}
