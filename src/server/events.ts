// src/server/events.ts
// Calendar event data access. Every function is scoped to the given user.

import { and, eq, gte, isNotNull, lt, lte, or } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db";
import { events } from "@/db/schema";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date, expected YYYY-MM-DD");
const dateTime = z.string().datetime({ offset: true, message: "Invalid time" });

// When an event is (re)timed, the whole timing is sent: the all-day flag plus
// the matching start/end pair
const timing = z.discriminatedUnion("allDay", [
  z.object({ allDay: z.literal(true), startDate: dateString, endDate: dateString }),
  z.object({ allDay: z.literal(false), startsAt: dateTime, endsAt: dateTime }),
]);

type Timing = z.infer<typeof timing>;

const timingIsOrdered = (t: Timing) =>
  t.allDay ? t.endDate >= t.startDate : new Date(t.endsAt) >= new Date(t.startsAt);

const details = z.object({
  title: z.string().trim().min(1, "Event title is required").max(200),
  notes: z.string().max(10_000).nullish(),
});

export const createEventInput = details
  .and(timing)
  .refine(timingIsOrdered, "The event ends before it starts");

const TIMING_KEYS = ["allDay", "startDate", "endDate", "startsAt", "endsAt"];

// Title and notes can change alone; any timing change must send the full timing
export const updateEventInput = details
  .partial()
  .extend({
    allDay: z.boolean().optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    startsAt: dateTime.optional(),
    endsAt: dateTime.optional(),
  })
  .superRefine((v, ctx) => {
    if (Object.keys(v).length === 0) {
      ctx.addIssue({ code: "custom", message: "Nothing to update" });
      return;
    }
    if (!TIMING_KEYS.some((key) => key in v)) return;
    const parsed = timing.safeParse(v);
    if (!parsed.success) {
      ctx.addIssue({ code: "custom", message: "Send allDay together with its start and end" });
    } else if (!timingIsOrdered(parsed.data)) {
      ctx.addIssue({ code: "custom", message: "The event ends before it starts" });
    }
  });

export const listEventsInput = z.object({ from: dateString, to: dateString });

export type CreateEventInput = z.infer<typeof createEventInput>;
export type UpdateEventInput = z.infer<typeof updateEventInput>;

// Column values for a timing; the other pair is cleared
function timingValues(t: Timing) {
  return t.allDay
    ? { allDay: true, startDate: t.startDate, endDate: t.endDate, startsAt: null, endsAt: null }
    : {
        allDay: false,
        startsAt: new Date(t.startsAt),
        endsAt: new Date(t.endsAt),
        startDate: null,
        endDate: null,
      };
}

const DAY_MS = 86_400_000;

// Events overlapping the days from..to. Timed events are matched with a day of
// margin on each side because the server does not know the user's time zone;
// the client places them on local days.
export async function listEvents(userId: string, { from, to }: z.infer<typeof listEventsInput>) {
  const rangeStart = new Date(Date.parse(from) - DAY_MS);
  const rangeEnd = new Date(Date.parse(to) + 2 * DAY_MS);
  return db
    .select()
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        or(
          and(isNotNull(events.startDate), lte(events.startDate, to), gte(events.endDate, from)),
          and(isNotNull(events.startsAt), lt(events.startsAt, rangeEnd), gte(events.endsAt, rangeStart))
        )
      )
    );
}

export async function createEvent(userId: string, input: CreateEventInput) {
  const [event] = await db
    .insert(events)
    .values({
      userId,
      title: input.title,
      notes: input.notes ?? null,
      ...timingValues(input),
    })
    .returning();
  return event;
}

// Returns null when the event does not exist or belongs to another user
export async function updateEvent(userId: string, id: string, input: UpdateEventInput) {
  const values: PgUpdateSetSource<typeof events> = {};
  if (input.title !== undefined) values.title = input.title;
  if (input.notes !== undefined) values.notes = input.notes;
  const newTiming = timing.safeParse(input);
  if (newTiming.success) Object.assign(values, timingValues(newTiming.data));

  const [updated] = await db
    .update(events)
    .set(values)
    .where(and(eq(events.id, id), eq(events.userId, userId)))
    .returning();
  return updated ?? null;
}

// Returns false when the event does not exist or belongs to another user
export async function deleteEvent(userId: string, id: string) {
  const deleted = await db
    .delete(events)
    .where(and(eq(events.id, id), eq(events.userId, userId)))
    .returning({ id: events.id });
  return deleted.length > 0;
}
