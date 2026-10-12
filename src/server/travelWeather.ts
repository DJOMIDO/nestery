// src/server/travelWeather.ts
// The forecast at both ends of the user's coming journeys: at the
// destination on the day they arrive, and at the origin on the day they
// leave. Flights use the airports' positions; trains look up the station
// (and its city) on OpenStreetMap. An end that isn't found is left out; the
// other still shows.

import type { Locale } from "@/i18n/config";
import type { JourneyWeather, PlaceWeather } from "@/lib/travel";
import { addDays } from "@/lib/tasks";
import type { WeatherPlace } from "@/lib/weather";
import { currentLocale } from "@/server/i18n";
import { findAirport, listJourneys } from "@/server/travel";
import { dailyForecast } from "@/server/weather";

// Forecasts don't reach further than about two weeks
const DAYS_AHEAD = 14;

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

// Journey id -> forecast, for journeys arriving from `today` (the user's day)
// through the next two weeks
export async function journeyWeather(userId: string, today: string) {
  const locale = await currentLocale();
  return weatherForJourneys(await listJourneys(userId, locale), today, locale);
}

type JourneyStop = Pick<
  Awaited<ReturnType<typeof listJourneys>>[number],
  "id" | "kind" | "origin" | "originCity" | "destination" | "destinationCity" | "departureDate" | "arrivalDate"
>;

// One end of a journey on its day there
interface End {
  journeyId: string;
  departure: boolean;
  kind: JourneyStop["kind"];
  code: string;
  city: string | null;
  day: string;
}

// The same for given journeys (separate from the query so it can be tested),
// with airports' cities named in `locale`
export async function weatherForJourneys(
  journeys: JourneyStop[],
  today: string,
  locale: Locale = "en"
): Promise<Record<string, JourneyWeather>> {
  const lastDay = addDays(today, DAYS_AHEAD - 1);
  const inRange = (day: string) => day >= today && day <= lastDay;
  const ends: End[] = journeys
    .filter((j) => inRange(j.arrivalDate ?? j.departureDate))
    .flatMap((j) => {
      const arrival: End = {
        journeyId: j.id,
        departure: false,
        kind: j.kind,
        code: j.destination,
        city: j.destinationCity,
        day: j.arrivalDate ?? j.departureDate,
      };
      // A departure already past (e.g. an overnight journey) has no forecast
      if (!inRange(j.departureDate)) return [arrival];
      return [
        arrival,
        { journeyId: j.id, departure: true, kind: j.kind, code: j.origin, city: j.originCity, day: j.departureDate },
      ];
    });

  // Where each end is; places are looked up once each
  const places = new Map<string, Promise<WeatherPlace | null>>();
  const placeOf = (key: string, find: () => Promise<WeatherPlace | null>) => {
    if (!places.has(key)) places.set(key, find().catch(() => null));
    return places.get(key)!;
  };
  // One at a time: stations are looked up on a free service, which turns
  // bursts away (each answer is then cached for a week)
  const located: (WeatherPlace | null)[] = [];
  for (const end of ends) {
    if (end.kind === "flight") {
      const airport = findAirport(end.code, locale);
      located.push(
        airport
          ? await placeOf(`airport:${airport.iata}`, async () => ({
              name: airport.city ?? airport.name,
              detail: null,
              latitude: airport.latitude,
              longitude: airport.longitude,
            }))
          : null
      );
      continue;
    }
    const city = end.city?.trim() || null;
    located.push(await placeOf(`station:${end.code}|${city ?? ""}`.toLowerCase(), () => findStation(end.code, city)));
  }

  // One forecast per place, long enough for its latest day; dates are the
  // place's own (timezone "auto"), like the journeys' dates
  const daysNeeded = new Map<WeatherPlace, number>();
  ends.forEach((end, i) => {
    const place = located[i];
    if (!place) return;
    // One extra day: the place's date can be a day ahead of the user's
    const days = daysBetween(today, end.day) + 2;
    daysNeeded.set(place, Math.max(daysNeeded.get(place) ?? 0, days));
  });
  const forecasts = new Map(
    [...daysNeeded].map(([place, days]) => [
      place,
      dailyForecast(place, null, Math.min(days, DAYS_AHEAD + 1)).catch(() => []),
    ])
  );

  const found = await Promise.all(
    ends.map(async (end, i): Promise<PlaceWeather | null> => {
      const place = located[i];
      if (!place) return null;
      const forecast = (await forecasts.get(place))?.find((d) => d.date === end.day);
      if (!forecast) return null;
      return {
        place: place.name,
        date: end.day,
        code: forecast.code,
        conditions: forecast.conditions,
        high: forecast.high,
        low: forecast.low,
        precipitation: forecast.precipitation,
      };
    })
  );

  const result: Record<string, JourneyWeather> = {};
  ends.forEach((end, i) => {
    const forecast = found[i];
    if (!forecast) return;
    result[end.journeyId] = { ...result[end.journeyId], [end.departure ? "departure" : "arrival"]: forecast };
  });
  return result;
}

// ---- Train places -----------------------------------------------------------

// Photon searches OpenStreetMap, which knows stations by their names in any
// language ("Paris Gare de Lyon", "上海虹桥站", "서울역"); Open-Meteo's own
// search only knows towns. Free, without a key; asked once a week per place.
const PHOTON_URL = "https://photon.komoot.io/api/";

// "Gare de Lyon" -> "garedelyon", for comparing names
const normalize = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

// The position of the best match for `query` whose name goes with `name`:
// one contains the other ("上海" in "上海市"), the shorter being at least
// half the longer ("Gare de Lyon" in "Paris Gare de Lyon"). Photon always
// answers with something; this keeps a name it doesn't know from landing on
// any street or café that shares a word ("Junction").
async function locate(query: string, name: string): Promise<{ latitude: number; longitude: number } | null> {
  const url = new URL(PHOTON_URL);
  url.search = new URLSearchParams({ q: query, limit: "5" }).toString();
  const res = await fetch(url, {
    next: { revalidate: 7 * 24 * 60 * 60 },
    headers: { "User-Agent": "Nestery (https://github.com/DJOMIDO/nestery)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Place search error (${res.status})`);
  const data = (await res.json()) as {
    features?: { geometry: { coordinates: [number, number] }; properties: { name?: string } }[];
  };
  const wanted = normalize(name);
  const match = data.features?.find((f) => {
    const found = normalize(f.properties.name ?? "");
    return !!found && (found.includes(wanted) || (wanted.includes(found) && found.length * 2 >= wanted.length));
  });
  const point = match?.geometry.coordinates;
  return point ? { latitude: point[1], longitude: point[0] } : null;
}

// Where a train's end is, named by its city when given, else the station.
// With a city, "station, city" keeps a short name ("Central") in the right
// town; the city alone is the fallback.
async function findStation(station: string, city: string | null): Promise<WeatherPlace | null> {
  // [what to search, the name a match must go with]
  const queries = city ? [[`${station}, ${city}`, station], [city, city]] : [[station, station]];
  for (const [query, name] of queries) {
    const position = await locate(query, name);
    if (position) return { name: city ?? station, detail: null, ...position };
  }
  return null;
}
