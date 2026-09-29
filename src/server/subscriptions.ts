// src/server/subscriptions.ts
// Calendar subscriptions: CRUD, refreshing feeds, and their events for a
// date range. Every function is scoped to the given user.

import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { calendarSubscriptions } from "@/db/schema";
import type { CalendarEvent } from "@/lib/calendar";
import { SUBSCRIPTION_COLOR_KEYS, type SubscriptionColor } from "@/lib/subscriptions";
import { FeedError, fetchIcs, normalizeFeedUrl } from "@/server/fetchIcs";
import { countFeedEvents, feedEvents } from "@/server/icsEvents";

// Feeds older than this are fetched again when their events are requested
const STALE_MS = 60 * 60 * 1000;
const MAX_SUBSCRIPTIONS = 10;

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date, expected YYYY-MM-DD");

export const createSubscriptionInput = z.object({
  name: z.string().trim().min(1, "Give the calendar a name").max(60),
  url: z.string().trim().min(1, "Paste the calendar's link").max(2000),
  color: z.enum(SUBSCRIPTION_COLOR_KEYS).default("sky"),
});

export const updateSubscriptionInput = z
  .object({
    name: createSubscriptionInput.shape.name,
    color: z.enum(SUBSCRIPTION_COLOR_KEYS),
    enabled: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const subscriptionEventsInput = z.object({
  from: dateString,
  to: dateString,
  // The viewer's IANA time zone, for feeds with floating times
  tz: z.string().max(64).default("UTC"),
});

// Everything but the cached feed, which can be large
const publicColumns = {
  id: calendarSubscriptions.id,
  name: calendarSubscriptions.name,
  url: calendarSubscriptions.url,
  color: calendarSubscriptions.color,
  enabled: calendarSubscriptions.enabled,
  lastFetchedAt: calendarSubscriptions.lastFetchedAt,
  lastError: calendarSubscriptions.lastError,
  createdAt: calendarSubscriptions.createdAt,
};

export async function listSubscriptions(userId: string) {
  return db
    .select(publicColumns)
    .from(calendarSubscriptions)
    .where(eq(calendarSubscriptions.userId, userId))
    .orderBy(asc(calendarSubscriptions.createdAt));
}

// Fetches and parses a feed; the message of a thrown FeedError is shown to the user
async function loadFeed(url: string) {
  const ics = await fetchIcs(url);
  try {
    countFeedEvents(ics);
  } catch {
    throw new FeedError("The calendar could not be read (invalid iCalendar data)");
  }
  return ics;
}

// Checks the feed before saving, so a wrong link is reported right away
export async function createSubscription(userId: string, input: z.infer<typeof createSubscriptionInput>) {
  const existing = await listSubscriptions(userId);
  if (existing.length >= MAX_SUBSCRIPTIONS) {
    throw new FeedError(`You can subscribe to at most ${MAX_SUBSCRIPTIONS} calendars`);
  }
  const url = normalizeFeedUrl(input.url).toString();
  const ics = await loadFeed(url);
  const [created] = await db
    .insert(calendarSubscriptions)
    .values({ userId, name: input.name, url, color: input.color, ics, lastFetchedAt: new Date() })
    .returning(publicColumns);
  return created;
}

export async function updateSubscription(
  userId: string,
  id: string,
  input: z.infer<typeof updateSubscriptionInput>
) {
  const [updated] = await db
    .update(calendarSubscriptions)
    .set(input)
    .where(and(eq(calendarSubscriptions.id, id), eq(calendarSubscriptions.userId, userId)))
    .returning(publicColumns);
  return updated ?? null;
}

export async function deleteSubscription(userId: string, id: string) {
  const deleted = await db
    .delete(calendarSubscriptions)
    .where(and(eq(calendarSubscriptions.id, id), eq(calendarSubscriptions.userId, userId)))
    .returning({ id: calendarSubscriptions.id });
  return deleted.length > 0;
}

// Fetches the feed again. A failure keeps the last good copy and records the error.
async function refresh(id: string, url: string) {
  try {
    const ics = await loadFeed(url);
    await db
      .update(calendarSubscriptions)
      .set({ ics, lastFetchedAt: new Date(), lastError: null })
      .where(eq(calendarSubscriptions.id, id));
    return ics;
  } catch (err) {
    const message = err instanceof FeedError ? err.message : "Refreshing the calendar failed";
    await db
      .update(calendarSubscriptions)
      .set({ lastFetchedAt: new Date(), lastError: message })
      .where(eq(calendarSubscriptions.id, id));
    return null;
  }
}

// Refresh on request (the Refresh button). Returns null if not the user's.
export async function refreshSubscription(userId: string, id: string) {
  const [row] = await db
    .select({ id: calendarSubscriptions.id, url: calendarSubscriptions.url })
    .from(calendarSubscriptions)
    .where(and(eq(calendarSubscriptions.id, id), eq(calendarSubscriptions.userId, userId)));
  if (!row) return null;
  await refresh(row.id, row.url);
  const [updated] = await db
    .select(publicColumns)
    .from(calendarSubscriptions)
    .where(eq(calendarSubscriptions.id, id));
  return updated;
}

// Events of all enabled subscriptions overlapping from..to, shaped like the
// user's own events plus a `source`. Stale feeds are refreshed first.
export async function subscriptionEvents(
  userId: string,
  { from, to, tz }: z.infer<typeof subscriptionEventsInput>
): Promise<CalendarEvent[]> {
  const rows = await db
    .select()
    .from(calendarSubscriptions)
    .where(and(eq(calendarSubscriptions.userId, userId), eq(calendarSubscriptions.enabled, true)));

  const perFeed = await Promise.all(
    rows.map(async (row) => {
      const stale = !row.lastFetchedAt || Date.now() - row.lastFetchedAt.getTime() > STALE_MS;
      const ics = (stale && (await refresh(row.id, row.url))) || row.ics;
      if (!ics) return [];
      let events;
      try {
        events = feedEvents(ics, { from, to, timeZone: tz });
      } catch {
        return [];
      }
      return events.map(
        (e): CalendarEvent => ({
          id: `sub:${row.id}:${e.uid}`,
          userId,
          title: e.title,
          notes: e.notes,
          allDay: e.allDay,
          startsAt: e.startsAt,
          endsAt: e.endsAt,
          startDate: e.startDate,
          endDate: e.endDate,
          rrule: null,
          exdates: [],
          seriesId: null,
          createdAt: "",
          updatedAt: "",
          source: {
            subscriptionId: row.id,
            name: row.name,
            color: row.color as SubscriptionColor,
            location: e.location,
          },
        })
      );
    })
  );
  return perFeed.flat();
}
