// src/server/travelWeather.ts
// The forecast at both ends of the user's coming journeys: at the
// destination on the day they arrive, and at the origin on the day they
// leave. Flights use the airports' positions; trains look up their cities
// (or stations) by name, and an end that isn't found is left out.

import type { JourneyWeather, PlaceWeather } from "@/lib/travel";
import { addDays } from "@/lib/tasks";
import type { WeatherPlace } from "@/lib/weather";
import { findAirport, listJourneys } from "@/server/travel";
import { dailyForecast, searchPlaces } from "@/server/weather";

// Forecasts don't reach further than about two weeks
const DAYS_AHEAD = 14;

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

// Journey id -> forecast, for journeys arriving from `today` (the user's day)
// through the next two weeks
export async function journeyWeather(userId: string, today: string) {
  return weatherForJourneys(await listJourneys(userId), today);
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

// The same for given journeys (separate from the query so it can be tested)
export async function weatherForJourneys(
  journeys: JourneyStop[],
  today: string
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
  const located = await Promise.all(
    ends.map(async (end) => {
      if (end.kind === "flight") {
        const airport = findAirport(end.code);
        if (!airport) return null;
        return placeOf(`airport:${airport.iata}`, async () => ({
          name: airport.city ?? airport.name,
          detail: null,
          latitude: airport.latitude,
          longitude: airport.longitude,
        }));
      }
      const name = end.city ?? end.code;
      return placeOf(`name:${name.toLowerCase()}`, async () => (await searchPlaces(name))[0] ?? null);
    })
  );

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

  // Keyed by the arrival's forecast, which lists and the calendar show;
  // the departure's rides along for the journey's details
  const result: Record<string, JourneyWeather> = {};
  ends.forEach((end, i) => {
    if (!end.departure && found[i]) result[end.journeyId] = { ...found[i] };
  });
  ends.forEach((end, i) => {
    if (end.departure && found[i] && result[end.journeyId]) result[end.journeyId].departure = found[i];
  });
  return result;
}
