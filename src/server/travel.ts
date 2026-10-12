// src/server/travel.ts
// Journeys (Travel) and the airport and airline lists. Every journey function
// is scoped to the given user.

import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { journeys } from "@/db/schema";
import { JOURNEY_KINDS, type Airline, type Airport } from "@/lib/travel";
import type { Locale } from "@/i18n/config";
import airlineRows from "@/server/travel/data/airlines.json";
import airlineZhRows from "@/server/travel/data/airlines-zh.json";
import airportRows from "@/server/travel/data/airports.json";
import airportZhRows from "@/server/travel/data/airports-zh.json";
import { currentLocale } from "@/server/i18n";

// ---- Airports and airlines (scripts/update-travel-data.mjs) ----------------
// Names are in English, and in Chinese for the Chinese interfaces; journeys
// keep only the codes, so names follow whatever language is shown.

const AIRPORTS = new Map<string, Airport>(
  (airportRows as [string, string, string | null, string, number, number, string][]).map(
    ([iata, name, city, country, latitude, longitude, timeZone]) => [
      iata,
      { iata, name, city, country, latitude, longitude, timeZone },
    ]
  )
);

const AIRLINES = new Map<string, Airline>(
  (airlineRows as [string, string][]).map(([iata, name]) => [iata, { iata, name }])
);

// IATA -> [Simplified name, Simplified city, Traditional name, Traditional city]
const AIRPORTS_ZH = airportZhRows as Record<string, (string | null)[]>;
// IATA -> [Simplified name, Traditional name, other Chinese names]
const AIRLINES_ZH = airlineZhRows as unknown as Record<string, [string | null, string | null, string[]]>;

// Which of the Chinese columns a language reads, if any
const zhColumn = (locale: Locale) => (locale === "zh-CN" ? 0 : locale === "zh-TW" ? 1 : null);

// An airport with its name and city in the language, where known
function localAirport(airport: Airport, locale: Locale): Airport {
  const column = zhColumn(locale);
  const zh = column === null ? undefined : AIRPORTS_ZH[airport.iata];
  if (!zh || column === null) return airport;
  return { ...airport, name: zh[column * 2] ?? airport.name, city: zh[column * 2 + 1] ?? airport.city };
}

function localAirline(airline: Airline, locale: Locale): Airline {
  const column = zhColumn(locale);
  const name = column === null ? null : AIRLINES_ZH[airline.iata]?.[column];
  return name ? { ...airline, name } : airline;
}

export function findAirport(code: string | null | undefined, locale: Locale = "en") {
  const airport = code ? AIRPORTS.get(code.toUpperCase()) : undefined;
  return airport && localAirport(airport, locale);
}

export function findAirline(code: string | null | undefined, locale: Locale = "en") {
  const airline = code ? AIRLINES.get(code.toUpperCase()) : undefined;
  return airline && localAirline(airline, locale);
}

// Best matches first: the exact code, then a main name (city or airline)
// equal to the query, starting with it, any name starting with it, any
// name containing it. Names in every language count, so "上海" finds PVG
// in the English interface too.
function search<T extends { iata: string }>(
  items: Iterable<T>,
  query: string,
  names: (item: T) => { main: string[]; other: string[] },
  limit = 8
) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: [number, T][] = [];
  for (const item of items) {
    const { main, other } = names(item);
    const primary = main.filter(Boolean).map((n) => n.toLowerCase());
    const all = [...primary, ...other.filter(Boolean).map((n) => n.toLowerCase())];
    const score =
      item.iata.toLowerCase() === q
        ? 0
        : primary.includes(q)
          ? 1
          : primary.some((n) => n.startsWith(q))
            ? 2
            : all.some((n) => n.startsWith(q))
              ? 3
              : all.some((n) => n.includes(q))
                ? 4
                : -1;
    if (score >= 0) scored.push([score, item]);
  }
  return scored.sort((a, b) => a[0] - b[0]).slice(0, limit).map(([, item]) => item);
}

export const searchAirports = (query: string, locale: Locale) =>
  search(AIRPORTS.values(), query, (a) => {
    const zh = AIRPORTS_ZH[a.iata] ?? [];
    return { main: [a.city ?? a.name, zh[1] ?? "", zh[3] ?? ""], other: [a.name, zh[0] ?? "", zh[2] ?? ""] };
  }).map((a) => localAirport(a, locale));

export const searchAirlines = (query: string, locale: Locale) =>
  search(AIRLINES.values(), query, (a) => {
    const [simplified, traditional, aliases] = AIRLINES_ZH[a.iata] ?? [null, null, []];
    return { main: [a.name, simplified ?? "", traditional ?? ""], other: aliases };
  }).map((a) => localAirline(a, locale));

// ---- Journeys ---------------------------------------------------------------

// A real calendar date (2026-13-01 would otherwise reach the database)
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD")
  .refine((v) => {
    const time = Date.parse(`${v}T00:00:00Z`);
    return !Number.isNaN(time) && new Date(time).toISOString().startsWith(v);
  }, "That date doesn't exist");
// "HH:mm"; some browsers and files add seconds, which are dropped
const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Use the time format HH:mm")
  .transform((v) => v.slice(0, 5));
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

export const journeyInput = z
  .object({
    kind: z.enum(JOURNEY_KINDS),
    carrier: z.string().trim().min(1, "The airline or company is required").max(100),
    // Required for flights; regional train tickets often have none
    number: z.string().trim().max(20),
    origin: z.string().trim().min(1, "Where from is required").max(100),
    destination: z.string().trim().min(1, "Where to is required").max(100),
    stopover: optionalText(100),
    originCity: optionalText(100),
    destinationCity: optionalText(100),
    departureDate: dateString,
    departureTime: timeString.nullish().transform((v) => v ?? null),
    arrivalDate: dateString.nullish().transform((v) => v ?? null),
    arrivalTime: timeString.nullish().transform((v) => v ?? null),
    seat: optionalText(20),
    gate: optionalText(20),
    coach: optionalText(20),
    vehicle: optionalText(100),
    aircraftReg: optionalText(20),
    price: z
      .union([z.number(), z.string().trim()])
      .nullish()
      .transform((v, ctx) => {
        if (v === null || v === undefined || v === "") return null;
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0 || n >= 1e10) {
          ctx.addIssue({ code: "custom", message: "The price must be a positive number" });
          return z.NEVER;
        }
        return n.toFixed(2);
      }),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Use a three-letter currency code such as EUR")
      .nullish()
      .transform((v) => v || null),
    bookingRef: optionalText(50),
    notes: optionalText(5000),
    // Minutes before departure, up to a week; null or absent = no reminder
    remindBefore: z
      .number()
      .int()
      .min(0)
      .max(7 * 24 * 60)
      .nullish()
      .transform((v) => v ?? null),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "flight") {
      for (const field of ["origin", "destination", "stopover"] as const) {
        if (v[field] && !/^[A-Za-z]{3}$/.test(v[field]!)) {
          ctx.addIssue({ code: "custom", path: [field], message: "Use a three-letter airport code such as CDG" });
        }
      }
      if (!v.number) ctx.addIssue({ code: "custom", path: ["number"], message: "The flight number is required" });
      if (!/^[A-Za-z0-9]{2,3}$/.test(v.carrier)) {
        ctx.addIssue({ code: "custom", path: ["carrier"], message: "Use the airline's two-letter code such as AF" });
      }
    }
    if (v.arrivalDate && v.arrivalDate < v.departureDate) {
      ctx.addIssue({ code: "custom", path: ["arrivalDate"], message: "The arrival is before the departure" });
    }
  })
  // Codes are stored in capitals; flights take their time zones from the airports
  .transform((v) =>
    v.kind === "flight"
      ? {
          ...v,
          carrier: v.carrier.toUpperCase(),
          origin: v.origin.toUpperCase(),
          destination: v.destination.toUpperCase(),
          stopover: v.stopover?.toUpperCase() ?? null,
          originCity: null,
          destinationCity: null,
          coach: null,
          departureTz: findAirport(v.origin)?.timeZone ?? null,
          arrivalTz: findAirport(v.destination)?.timeZone ?? null,
        }
      : { ...v, stopover: null, gate: null, aircraftReg: null, departureTz: null, arrivalTz: null }
  );

export type JourneyInput = z.infer<typeof journeyInput>;

export const importJourneysInput = z.object({
  // Rows are checked one by one, so a bad row doesn't stop the others
  rows: z.array(z.unknown()).min(1, "The file has no rows").max(2000, "Import at most 2,000 rows at once"),
});

type JourneyRow = typeof journeys.$inferSelect;

// Great-circle distance in km (haversine)
function distanceKm(a: Airport, b: Airport) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)));
}

// Adds the airline's and airports' names (in the language) when the codes
// are known, and the distance flown (through the stopover, if any)
function withNames(row: JourneyRow, locale: Locale) {
  const flight = row.kind === "flight";
  const airport = (code: string) => (flight ? findAirport(code, locale) : undefined);
  const stops = flight ? [row.origin, row.stopover, row.destination].filter(Boolean).map((c) => findAirport(c)) : [];
  const distance =
    stops.length >= 2 && stops.every(Boolean)
      ? stops.slice(1).reduce((km, airport, i) => km + distanceKm(stops[i]!, airport!), 0)
      : undefined;
  return {
    ...row,
    carrierName: flight ? findAirline(row.carrier, locale)?.name : undefined,
    // The city (or the airport, when its city isn't known)
    originName: airport(row.origin)?.city ?? airport(row.origin)?.name,
    destinationName: airport(row.destination)?.city ?? airport(row.destination)?.name,
    originAirport: airport(row.origin)?.name,
    destinationAirport: airport(row.destination)?.name,
    distanceKm: distance,
  };
}

// Duplicates (same flight or train on the same day) are a 409, not a crash
export class DuplicateJourneyError extends Error {}

const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && ("code" in err ? err.code : (err as { cause?: { code?: string } }).cause?.code) === "23505";

// Names come in `locale`, by default the current request's language
export async function listJourneys(userId: string, locale?: Locale) {
  const language = locale ?? (await currentLocale());
  const rows = await db
    .select()
    .from(journeys)
    .where(eq(journeys.userId, userId))
    .orderBy(desc(journeys.departureDate), asc(journeys.departureTime));
  return rows.map((row) => withNames(row, language));
}

export async function createJourney(userId: string, input: JourneyInput) {
  try {
    const [row] = await db.insert(journeys).values({ userId, ...input }).returning();
    return withNames(row, await currentLocale());
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateJourneyError("This journey is already in your list");
    throw err;
  }
}

export async function updateJourney(userId: string, id: string, input: JourneyInput) {
  try {
    const [row] = await db
      .update(journeys)
      .set(input)
      .where(and(eq(journeys.id, id), eq(journeys.userId, userId)))
      .returning();
    return row ? withNames(row, await currentLocale()) : null;
  } catch (err) {
    if (isUniqueViolation(err)) throw new DuplicateJourneyError("This journey is already in your list");
    throw err;
  }
}

export async function deleteJourney(userId: string, id: string) {
  const [row] = await db
    .delete(journeys)
    .where(and(eq(journeys.id, id), eq(journeys.userId, userId)))
    .returning({ id: journeys.id });
  return !!row;
}

// Valid rows are added; journeys already in the list are skipped; invalid
// rows are reported by their position (1-based, as in the preview)
export async function importJourneys(userId: string, rows: unknown[]) {
  const errors: { row: number; message: string }[] = [];
  const valid: (JourneyInput & { userId: string })[] = [];
  rows.forEach((row, i) => {
    const parsed = journeyInput.safeParse(row);
    if (parsed.success) valid.push({ userId, ...parsed.data });
    else errors.push({ row: i + 1, message: parsed.error.issues[0]?.message ?? "Invalid row" });
  });
  const inserted = valid.length
    ? await db.insert(journeys).values(valid).onConflictDoNothing().returning({ id: journeys.id })
    : [];
  return { imported: inserted.length, skipped: valid.length - inserted.length, errors };
}
