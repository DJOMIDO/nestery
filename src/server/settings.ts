// src/server/settings.ts
// Per-user preferences. A user without a saved row gets the defaults.

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { MAX_HOLIDAY_COUNTRIES } from "@/lib/calendar";
import {
  DATE_LOCALES,
  DEFAULT_DATE_TIME,
  type DateLocale,
  type HourCycle,
  type WeekStart,
} from "@/lib/format";
import { isTimeZone } from "@/server/timeZones";

const localeValues = DATE_LOCALES.map((l) => l.value) as [DateLocale, ...DateLocale[]];

// Any subset can be saved; missing fields keep their current values
export const updateSettingsInput = z
  .object({
    holidayCountries: z
      .array(z.string().regex(/^[A-Z]{2}$/, "Use two-letter country codes"))
      .max(MAX_HOLIDAY_COUNTRIES, `Choose at most ${MAX_HOLIDAY_COUNTRIES} countries`)
      .transform((codes) => [...new Set(codes)]),
    dateLocale: z.enum(localeValues),
    hourCycle: z.enum(["h12", "h23"]).nullable(),
    weekStart: z.union([z.literal(0), z.literal(1)]),
    timeZone: z.string().max(64).refine(isTimeZone, "Unknown time zone"),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export type UpdateSettingsInput = z.infer<typeof updateSettingsInput>;

// `saved` tells the client whether to fall back to its own holiday guess
export async function getSettings(userId: string) {
  const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
  return {
    holidayCountries: row?.holidayCountries ?? [],
    dateLocale: (row?.dateLocale ?? DEFAULT_DATE_TIME.dateLocale) as DateLocale,
    hourCycle: (row?.hourCycle ?? DEFAULT_DATE_TIME.hourCycle) as HourCycle | null,
    weekStart: (row?.weekStart ?? DEFAULT_DATE_TIME.weekStart) as WeekStart,
    timeZone: row?.timeZone ?? null,
    // Only ever sent to the user it belongs to
    feedToken: row?.feedToken ?? null,
    saved: !!row,
  };
}

export async function updateSettings(userId: string, input: UpdateSettingsInput) {
  await db
    .insert(userSettings)
    .values({ userId, ...input })
    .onConflictDoUpdate({ target: userSettings.userId, set: input });
  return getSettings(userId);
}

// A new secret for the calendar feed URL; any previous link stops working
export async function createFeedToken(userId: string) {
  const feedToken = randomBytes(32).toString("base64url");
  await db
    .insert(userSettings)
    .values({ userId, feedToken })
    .onConflictDoUpdate({ target: userSettings.userId, set: { feedToken } });
  return getSettings(userId);
}

// Turns the calendar feed off
export async function revokeFeedToken(userId: string) {
  await db.update(userSettings).set({ feedToken: null }).where(eq(userSettings.userId, userId));
  return getSettings(userId);
}

// The owner of a feed token, with the time zone to write their feed in
export async function feedOwner(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const [row] = await db
    .select({ userId: userSettings.userId, timeZone: userSettings.timeZone })
    .from(userSettings)
    .where(eq(userSettings.feedToken, token));
  return row ?? null;
}
