// src/lib/travel.ts
// Travel types and CSV columns shared by the server and the pages. Keep this
// file free of server-only imports.

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
  createdAt: string;
  updatedAt: string;
  // From the airport and airline lists, when the codes are known
  carrierName?: string;
  originName?: string;
  destinationName?: string;
}

// Shape accepted by POST /api/journeys and PUT /api/journeys/[id]
export type JourneyInput = Omit<
  Journey,
  "id" | "createdAt" | "updatedAt" | "departureTz" | "arrivalTz" | "carrierName" | "originName" | "destinationName"
>;

export interface Airport {
  iata: string;
  name: string;
  city: string | null;
  country: string;
  timeZone: string;
}

export interface Airline {
  iata: string;
  name: string;
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
export const journeyLabel = (j: Pick<Journey, "carrier" | "number">) => `${j.carrier} ${j.number}`;
