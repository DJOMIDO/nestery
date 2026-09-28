// src/server/settings.ts
// Per-user preferences. A user without a saved row gets the defaults.

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
