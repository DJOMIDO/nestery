// src/lib/travel.ts
// Travel types and CSV columns shared by the server and the pages. Keep this
// file free of server-only imports.

import type { CalendarEvent } from "@/lib/calendar";
// Plain Intl, safe in the browser too
import { wallTimeIn, wallTimeToDate } from "@/server/timeZones";

export const JOURNEY_KINDS = ["flight", "train"] as const;

export type JourneyKind = (typeof JOURNEY_KINDS)[number];

// A journey as returned by /api/journeys
export interface Journey {
  id: string;
  kind: JourneyKind;
  carrier: string;
  number: string;
  origin: string;
  destination: string;
  stopover: string | null;
  originCity: string | null;
  destinationCity: string | null;
  departureDate: string; // YYYY-MM-DD, local at the origin
  departureTime: string | null; // HH:mm
  arrivalDate: string | null;
  arrivalTime: string | null;
  departureTz: string | null;
  arrivalTz: string | null;
  seat: string | null;
  gate: string | null;
  coach: string | null;
  vehicle: string | null;
  aircraftReg: string | null;
  price: string | null; // decimal, e.g. "129.90"
  currency: string | null;
  bookingRef: string | null;
  notes: string | null;
  // Minutes before departure; null = no reminder
  remindBefore: number | null;
  createdAt: string;
  updatedAt: string;
  // From the airport and airline lists, when the codes are known
  carrierName?: string;
  originName?: string;
  destinationName?: string;
  // Flights between known airports: great-circle distance
  distanceKm?: number;
}

// Shape accepted by POST /api/journeys and PUT /api/journeys/[id]
export type JourneyInput = Omit<
  Journey,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "departureTz"
  | "arrivalTz"
  | "carrierName"
  | "originName"
  | "destinationName"
  | "distanceKm"
>;

export interface Airport {
  iata: string;
  name: string;
  city: string | null;
  country: string;
  latitude: number;
  longitude: number;
  timeZone: string;
}

// A day's forecast at one end of a journey
export interface PlaceWeather {
  place: string;
  date: string; // YYYY-MM-DD, local at that place
  code: number; // WMO weather code
  conditions: string;
  high: number;
  low: number;
  precipitation: number | null; // highest chance that day, %
}

// The forecast at a journey's destination on its arrival day, and at its
// origin on the departure day when that is known and not yet past
export interface JourneyWeather extends PlaceWeather {
  departure?: PlaceWeather;
}

export interface Airline {
  iata: string;
  name: string;
}

// Reminder choices in the form, in minutes before departure
export const REMINDER_OPTIONS = [30, 60, 120, 180, 1440];

// For new journeys: time to get to the airport and through security, or to
// the station
export const DEFAULT_REMIND_BEFORE: Record<JourneyKind, number> = { flight: 180, train: 60 };

// A reminder's lead time in its largest whole unit, for "3 hours before"
export function reminderParts(minutes: number): { unit: "day" | "hour" | "minute"; count: number } {
  if (minutes % 1440 === 0) return { unit: "day", count: minutes / 1440 };
  if (minutes % 60 === 0) return { unit: "hour", count: minutes / 60 };
  return { unit: "minute", count: minutes };
}

// CSV columns, the same as in the original travel tracker (noname-app), so
// its files and its database tables import as they are
export const CSV_COLUMNS: Record<JourneyKind, readonly string[]> = {
  flight: [
    "airline_code", "flight_number", "departure_airport", "stopover_airport", "arrival_airport",
    "departure_date", "departure_time", "arrival_date", "arrival_time", "gate", "seat_number",
    "aircraft_type", "aircraft_reg", "price", "currency", "booking_ref", "notes",
  ],
  train: [
    "train_company", "train_number", "train_type", "departure_station", "arrival_station",
    "departure_city", "arrival_city", "departure_date", "departure_time", "arrival_date",
    "arrival_time", "coach", "seat_number", "price", "currency", "booking_ref", "notes",
  ],
};

// A CSV row (column -> value) as a journey; validation happens on the server
export function journeyFromCsv(kind: JourneyKind, row: Record<string, string>): JourneyInput {
  const v = (column: string) => row[column]?.trim() || null;
  const time = (column: string) => v(column)?.slice(0, 5) ?? null;
  const shared = {
    kind,
    departureDate: v("departure_date") ?? "",
    departureTime: time("departure_time"),
    arrivalDate: v("arrival_date"),
    arrivalTime: time("arrival_time"),
    seat: v("seat_number"),
    price: v("price"),
    currency: v("currency")?.toUpperCase() ?? null,
    bookingRef: v("booking_ref"),
    notes: v("notes"),
    remindBefore: DEFAULT_REMIND_BEFORE[kind],
  };
  return kind === "flight"
    ? {
        ...shared,
        carrier: v("airline_code")?.toUpperCase() ?? "",
        number: v("flight_number") ?? "",
        origin: v("departure_airport")?.toUpperCase() ?? "",
        destination: v("arrival_airport")?.toUpperCase() ?? "",
        stopover: v("stopover_airport")?.toUpperCase() ?? null,
        originCity: null,
        destinationCity: null,
        gate: v("gate"),
        coach: null,
        vehicle: v("aircraft_type"),
        aircraftReg: v("aircraft_reg"),
      }
    : {
        ...shared,
        carrier: v("train_company") ?? "",
        number: v("train_number") ?? "",
        origin: v("departure_station") ?? "",
        destination: v("arrival_station") ?? "",
        stopover: null,
        originCity: v("departure_city"),
        destinationCity: v("arrival_city"),
        gate: null,
        coach: v("coach"),
        vehicle: v("train_type"),
        aircraftReg: null,
      };
}

// "AF 1234" / "SNCF 6201": how a journey is named in lists
export const journeyLabel = (j: Pick<Journey, "carrier" | "number">) => `${j.carrier} ${j.number}`.trim();

const HOUR_MS = 60 * 60 * 1000;

// When a journey leaves and arrives, as real moments. Each end's time is on
// its own clock (the airport's zone); ends without a zone use `fallbackZone`,
// or the viewer's own clock when that is absent too. Null without a
// departure time. A missing or inconsistent arrival becomes one hour later.
export function journeyTimes(
  j: Pick<Journey, "departureDate" | "departureTime" | "arrivalDate" | "arrivalTime" | "departureTz" | "arrivalTz">,
  fallbackZone?: string
) {
  if (!j.departureTime) return null;
  const at = (date: string, time: string, zone: string | null) => {
    const tz = zone ?? fallbackZone;
    if (!tz) return new Date(`${date}T${time}`);
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    return wallTimeToDate({ year, month, day, hour, minute, second: 0 }, tz);
  };
  const start = at(j.departureDate, j.departureTime, j.departureTz);
  let end = j.arrivalTime ? at(j.arrivalDate ?? j.departureDate, j.arrivalTime, j.arrivalTz) : null;
  if (!end || end <= start) end = new Date(start.getTime() + HOUR_MS);
  return { start, end };
}

// "3U 8888 PEK → CTU": how a journey appears in Nestery, next to its icon
export const journeyRoute = (j: Pick<Journey, "carrier" | "number" | "origin" | "destination">) =>
  `${journeyLabel(j)} ${j.origin} → ${j.destination}`;

// "✈ 3U 8888 PEK → CTU": for other calendar apps, which only show text
export const journeyTitle = (j: Pick<Journey, "kind" | "carrier" | "number" | "origin" | "destination">) =>
  `${j.kind === "flight" ? "✈" : "🚆"} ${journeyRoute(j)}`;

// Text for a journey shown as an event, in the interface language
export interface JourneyEventText {
  // The calendar it appears to come from ("Travel")
  source: string;
  // "Seat 23A" and the like
  detail: (field: "seat" | "coach" | "gate" | "booking", value: string) => string;
}

// A journey as a read-only calendar event (like a subscribed calendar's),
// so the calendar and the dashboard show it without storing a copy
export function journeyToEvent(j: Journey, text: JourneyEventText): CalendarEvent {
  const times = journeyTimes(j);
  const details = [
    j.carrierName,
    j.seat && text.detail("seat", j.seat),
    j.coach && text.detail("coach", j.coach),
    j.gate && text.detail("gate", j.gate),
    j.bookingRef && text.detail("booking", j.bookingRef),
    j.notes,
  ].filter(Boolean);
  return {
    id: `journey:${j.id}`,
    userId: "",
    title: journeyRoute(j),
    notes: details.length ? details.join("\n") : null,
    allDay: !times,
    startsAt: times?.start.toISOString() ?? null,
    endsAt: times?.end.toISOString() ?? null,
    startDate: times ? null : j.departureDate,
    endDate: times ? null : (j.arrivalDate ?? j.departureDate),
    rrule: null,
    exdates: [],
    seriesId: null,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
    source: {
      subscriptionId: "travel",
      journeyId: j.id,
      journeyKind: j.kind,
      name: text.source,
      color: "indigo",
      location: `${j.originName ?? j.originCity ?? j.origin} → ${j.destinationName ?? j.destinationCity ?? j.destination}`,
    },
  };
}

// How long the journey takes, for "2h 45m"; null when the arrival time isn't known
export function journeyDuration(j: Parameters<typeof journeyTimes>[0]) {
  if (!j.arrivalTime) return null;
  const times = journeyTimes(j);
  if (!times) return null;
  const total = Math.round((times.end.getTime() - times.start.getTime()) / 60_000);
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

// Minutes a zone's clock is ahead of UTC at a moment
const zoneOffset = (moment: Date, zone: string) => {
  const w = wallTimeIn(moment, zone);
  return Math.round((Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - moment.getTime()) / 60_000);
};

// How far the arrival's clock is ahead of the departure's, in minutes
// (negative when behind); null unless both ends' zones are known
export function journeyTimeDifference(j: Parameters<typeof journeyTimes>[0]) {
  if (!j.departureTz || !j.arrivalTz) return null;
  const times = journeyTimes(j);
  const start = times?.start ?? new Date(`${j.departureDate}T12:00:00Z`);
  return zoneOffset(times?.end ?? start, j.arrivalTz) - zoneOffset(start, j.departureTz);
}

// Days between the departure's date and the arrival's, each local: 1 for
// "+1" on an overnight flight, -1 across the date line eastwards; 0 when
// the arrival date isn't known
export function journeyDayShift(j: Pick<Journey, "departureDate" | "arrivalDate">) {
  if (!j.arrivalDate) return 0;
  return Math.round((Date.parse(j.arrivalDate) - Date.parse(j.departureDate)) / 86_400_000);
}

// When to remind about a journey, or null (no reminder or no departure time)
export function journeyReminderAt(
  j: Parameters<typeof journeyTimes>[0] & Pick<Journey, "remindBefore">,
  fallbackZone?: string
) {
  if (j.remindBefore === null) return null;
  const times = journeyTimes(j, fallbackZone);
  return times ? new Date(times.start.getTime() - j.remindBefore * 60_000) : null;
}
