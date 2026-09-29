// src/server/icsEvents.ts
// Reads events out of an iCalendar feed with ical.js, expanding repeating ones
// (including exceptions) for a date range.

import ICAL from "ical.js";

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

// Wall-clock time in an IANA zone -> the instant it names
function zonedToDate(t: ICAL.Time, timeZone: string) {
  const asUtc = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
  try {
    // The zone's offset at (about) that moment, found by formatting in the zone
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(asUtc));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const shown = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    return new Date(asUtc - (shown - asUtc));
  } catch {
    return new Date(asUtc); // unknown zone name: treat as UTC
  }
}

// ICAL.Time -> Date. Zones defined in the feed and UTC are handled by ical.js;
// a TZID the feed does not define is looked up by name; floating times are
// read in the viewer's own time zone.
function toDate(t: ICAL.Time, viewerZone: string) {
  const zone = t.zone?.tzid;
  if (zone === "UTC" || (zone && zone !== "floating")) return t.toJSDate();
  const tzid = (t as unknown as { timezone?: string }).timezone;
  return zonedToDate(t, tzid && tzid !== "floating" ? tzid : viewerZone);
}

const dateKey = (t: ICAL.Time) =>
  `${String(t.year).padStart(4, "0")}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;

function parseCalendar(ics: string) {
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
    if (start.isDate) {
      // DTEND of an all-day event is exclusive
      const endExclusive = end && end.compare(start) > 0 ? end.clone() : start.clone();
      if (!end || end.compare(start) <= 0) endExclusive.adjust(1, 0, 0, 0);
      endExclusive.adjust(-1, 0, 0, 0);
      const startDate = dateKey(start);
      const endDate = dateKey(endExclusive);
      if (startDate > to || endDate < from) return;
      results.push({ ...base, allDay: true, startsAt: null, endsAt: null, startDate, endDate });
    } else {
      const s = toDate(start, timeZone);
      const e = end ? toDate(end, timeZone) : s;
      if (s.getTime() >= rangeEnd || e.getTime() < rangeStart) return;
      results.push({
        ...base,
        allDay: false,
        startsAt: s.toISOString(),
        endsAt: (e < s ? s : e).toISOString(),
        startDate: null,
        endDate: null,
      });
    }
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
