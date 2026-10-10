// src/server/travel.ts
// Journeys (Travel) and the airport and airline lists. Every journey function
// is scoped to the given user.

import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { journeys } from "@/db/schema";
import { JOURNEY_KINDS, type Airline, type Airport } from "@/lib/travel";
import airlineRows from "@/server/travel/data/airlines.json";
import airportRows from "@/server/travel/data/airports.json";

// ---- Airports and airlines (scripts/update-travel-data.mjs) ----------------

const AIRPORTS = new Map<string, Airport>(
  (airportRows as [string, string, string | null, string, number, number, string][]).map(
    ([iata, name, city, country, , , timeZone]) => [iata, { iata, name, city, country, timeZone }]
  )
);

const AIRLINES = new Map<string, Airline>(
  (airlineRows as [string, string][]).map(([iata, name]) => [iata, { iata, name }])
);

export const findAirport = (code: string | null | undefined) => (code ? AIRPORTS.get(code.toUpperCase()) : undefined);
export const findAirline = (code: string | null | undefined) => (code ? AIRLINES.get(code.toUpperCase()) : undefined);

// Best matches first: the exact code, then the main field (city or airline
// name) equal to the query, starting with it, any field starting with it,
// any field containing it
function search<T extends { iata: string; name: string }>(
  items: Iterable<T>,
  query: string,
  main: (item: T) => string,
  limit = 8
) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: [number, T][] = [];
  for (const item of items) {
    const primary = main(item).toLowerCase();
    const fields = [primary, item.name.toLowerCase()];
    const score =
      item.iata.toLowerCase() === q
        ? 0
        : primary === q
          ? 1
          : primary.startsWith(q)
            ? 2
            : fields.some((f) => f.startsWith(q))
              ? 3
              : fields.some((f) => f.includes(q))
                ? 4
                : -1;
    if (score >= 0) scored.push([score, item]);
  }
  return scored.sort((a, b) => a[0] - b[0]).slice(0, limit).map(([, item]) => item);
}

export const searchAirports = (query: string) => search(AIRPORTS.values(), query, (a) => a.city ?? a.name);

export const searchAirlines = (query: string) => search(AIRLINES.values(), query, (a) => a.name);

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
    number: z.string().trim().min(1, "The flight or train number is required").max(20),
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
  })
  .superRefine((v, ctx) => {
    if (v.kind === "flight") {
      for (const field of ["origin", "destination", "stopover"] as const) {
        if (v[field] && !/^[A-Za-z]{3}$/.test(v[field]!)) {
          ctx.addIssue({ code: "custom", path: [field], message: "Use a three-letter airport code such as CDG" });
        }
      }
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

// Adds the airline and airport names when the codes are known
function withNames(row: JourneyRow) {
  if (row.kind !== "flight") return row;
  return {
    ...row,
    carrierName: findAirline(row.carrier)?.name,
    originName: findAirport(row.origin)?.city ?? findAirport(row.origin)?.name,
    destinationName: findAirport(row.destination)?.city ?? findAirport(row.destination)?.name,
  };
}

// Duplicates (same flight or train on the same day) are a 409, not a crash
export class DuplicateJourneyError extends Error {}

const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && ("code" in err ? err.code : (err as { cause?: { code?: string } }).cause?.code) === "23505";

export async function listJourneys(userId: string) {
  const rows = await db
    .select()
    .from(journeys)
    .where(eq(journeys.userId, userId))
    .orderBy(desc(journeys.departureDate), asc(journeys.departureTime));
  return rows.map(withNames);
}

export async function createJourney(userId: string, input: JourneyInput) {
  try {
    const [row] = await db.insert(journeys).values({ userId, ...input }).returning();
    return withNames(row);
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
    return row ? withNames(row) : null;
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
