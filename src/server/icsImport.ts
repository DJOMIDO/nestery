// src/server/icsImport.ts
// Turns an .ics file into Nestery events. planImport is pure (text in, plan
// out) so the preview and the actual import agree; importIcs writes the plan.

import ICAL from "ical.js";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import { durationFitsRule, formatRRule, parseRRule } from "@/lib/recurrence";
import { localDateOf, parseCalendar, readTiming, type IcsTiming } from "@/server/icsEvents";

export const MAX_IMPORT_EVENTS = 2000;

// A problem with the file itself; its message is shown to the user
export class ImportError extends Error {}

// What to do with a repeating event whose rule Nestery cannot represent
export type UnsupportedChoice = "first" | "skip";

export interface PlannedEvent {
  icsUid: string;
  title: string;
  notes: string | null;
  timing: IcsTiming;
  rrule: string | null;
  exdates: string[];
  // Occurrences edited in the file; imported as their own events in the series
  exceptions: Omit<PlannedEvent, "exceptions" | "rrule" | "exdates">[];
}

export interface ImportSummary {
  found: number; // events in the file, not counting edited occurrences
  toImport: number; // events that will be created (incl. edited occurrences)
  repeating: number; // imported with their repeat rule
  unsupported: number; // repeating with a rule Nestery can't represent
  alreadyImported: number;
  cancelled: number;
}

const DAY_MS = 86_400_000;

// SUMMARY/DESCRIPTION/LOCATION -> title and notes within Nestery's limits
function details(event: ICAL.Event) {
  const location = event.location?.trim();
  const description = event.description?.trim();
  const notes = [location && `Location: ${location}`, description].filter(Boolean).join("\n\n");
  return {
    title: (event.summary?.trim() || "(No title)").slice(0, 200),
    notes: notes ? notes.slice(0, 10_000) : null,
  };
}

// The event's RRULE as Nestery stores it, or null when it can't be represented
// (unsupported parts, RDATEs, several rules, or occurrences that would overlap)
function supportedRule(event: ICAL.Event, timing: IcsTiming) {
  const component = event.component;
  if (component.getAllProperties("rrule").length !== 1 || component.hasProperty("rdate")) return null;
  const recur = component.getFirstPropertyValue("rrule") as ICAL.Recur;
  const rule = parseRRule(recur.toString());
  if (!rule) return null;
  const fits = durationFitsRule(
    rule,
    timing.allDay
      ? { days: Math.round((Date.parse(timing.endDate) - Date.parse(timing.startDate)) / DAY_MS) + 1 }
      : { ms: Date.parse(timing.endsAt) - Date.parse(timing.startsAt) }
  );
  return fits ? formatRRule(rule) : null;
}

export function planImport(
  ics: string,
  { timeZone, unsupported, existingUids }: { timeZone: string; unsupported: UnsupportedChoice; existingUids: Set<string> }
) {
  let calendar: ICAL.Component;
  try {
    calendar = parseCalendar(ics);
  } catch {
    throw new ImportError("The file could not be read (invalid iCalendar data)");
  }
  const summary: ImportSummary = { found: 0, toImport: 0, repeating: 0, unsupported: 0, alreadyImported: 0, cancelled: 0 };
  const series = new Map<string, PlannedEvent>();
  const planned: PlannedEvent[] = [];
  const exceptions: ICAL.Event[] = [];

  for (const component of calendar.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(component);
    if (!event.startDate) continue;
    if (event.isRecurrenceException()) {
      exceptions.push(event);
      continue;
    }
    summary.found++;
    if (component.getFirstPropertyValue("status") === "CANCELLED") {
      summary.cancelled++;
      continue;
    }
    const icsUid = event.uid || `${event.summary}-${event.startDate}`;
    if (existingUids.has(icsUid) || series.has(icsUid)) {
      summary.alreadyImported++;
      continue;
    }

    const timing = readTiming(event.startDate, event.endDate, timeZone);
    let rrule: string | null = null;
    if (event.isRecurring()) {
      rrule = supportedRule(event, timing);
      if (rrule) summary.repeating++;
      else {
        summary.unsupported++;
        if (unsupported === "skip") continue;
      }
    }
    // Removed occurrences, by local date
    const exdates = rrule
      ? component
          .getAllProperties("exdate")
          .flatMap((p) => p.getValues() as ICAL.Time[])
          .map((t) => localDateOf(t, timeZone))
      : [];

    const plan: PlannedEvent = { icsUid, ...details(event), timing, rrule, exdates, exceptions: [] };
    planned.push(plan);
    series.set(icsUid, plan);
  }

  // Edited occurrences join their series; the series skips that date
  for (const exception of exceptions) {
    if (exception.component.getFirstPropertyValue("status") === "CANCELLED") continue;
    const parent = series.get(exception.uid);
    if (!parent?.rrule) continue; // imported as a single event (or skipped): nothing to attach to
    const date = localDateOf(exception.recurrenceId, timeZone);
    const icsUid = `${exception.uid}#${exception.recurrenceId.toString()}`;
    if (existingUids.has(icsUid)) continue;
    parent.exdates.push(date);
    parent.exceptions.push({
      icsUid,
      ...details(exception),
      timing: readTiming(exception.startDate, exception.endDate, timeZone),
    });
  }

  for (const plan of planned) {
    plan.exdates = [...new Set(plan.exdates)].sort();
    summary.toImport += 1 + plan.exceptions.length;
  }
  return { planned, summary };
}

// Timing as database columns (timestamps as Dates)
const timingColumns = (t: IcsTiming) =>
  t.allDay
    ? { allDay: true, startDate: t.startDate, endDate: t.endDate, startsAt: null, endsAt: null }
    : { allDay: false, startsAt: new Date(t.startsAt), endsAt: new Date(t.endsAt), startDate: null, endDate: null };

// UIDs already imported by this user, so a second import skips them
async function importedUids(userId: string) {
  const rows = await db
    .select({ icsUid: events.icsUid })
    .from(events)
    .where(and(eq(events.userId, userId), isNotNull(events.icsUid)));
  return new Set(rows.map((r) => r.icsUid!));
}

export async function previewImport(userId: string, ics: string, timeZone: string, unsupported: UnsupportedChoice) {
  return planImport(ics, { timeZone, unsupported, existingUids: await importedUids(userId) }).summary;
}

// Creates the planned events in one transaction; returns how many were added
export async function importIcs(userId: string, ics: string, timeZone: string, unsupported: UnsupportedChoice) {
  const { planned, summary } = planImport(ics, { timeZone, unsupported, existingUids: await importedUids(userId) });
  if (summary.toImport > MAX_IMPORT_EVENTS) {
    throw new ImportError(`That file has ${summary.toImport} events; at most ${MAX_IMPORT_EVENTS} can be imported at once`);
  }

  let created = 0;
  await db.transaction(async (tx) => {
    for (const plan of planned) {
      const [series] = await tx
        .insert(events)
        .values({
          userId,
          icsUid: plan.icsUid,
          title: plan.title,
          notes: plan.notes,
          rrule: plan.rrule,
          exdates: plan.exdates,
          ...timingColumns(plan.timing),
        })
        // Imported twice at the same moment: the unique index keeps one
        .onConflictDoNothing()
        .returning({ id: events.id });
      if (!series) continue;
      created++;
      if (plan.exceptions.length === 0) continue;
      const rows = await tx
        .insert(events)
        .values(
          plan.exceptions.map((e) => ({
            userId,
            icsUid: e.icsUid,
            title: e.title,
            notes: e.notes,
            seriesId: series.id,
            ...timingColumns(e.timing),
          }))
        )
        .onConflictDoNothing()
        .returning({ id: events.id });
      created += rows.length;
    }
  });
  return { created, summary };
}
