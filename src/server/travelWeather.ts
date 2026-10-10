// src/server/travelWeather.ts
// The forecast at the destination of the user's coming journeys, on the day
// they arrive. Flights use the airport's position; trains look up their
// destination city (or station) by name and are left out if it isn't found.

import type { JourneyWeather } from "@/lib/travel";
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
  "id" | "kind" | "destination" | "destinationCity" | "departureDate" | "arrivalDate"
>;

// The same for given journeys (separate from the query so it can be tested)
export async function weatherForJourneys(
  journeys: JourneyStop[],
  today: string
): Promise<Record<string, JourneyWeather>> {
  const lastDay = addDays(today, DAYS_AHEAD - 1);
  const coming = journeys.filter((j) => {
    const day = j.arrivalDate ?? j.departureDate;
    return day >= today && day <= lastDay;
  });

  // Where each journey ends; places are looked up once each
  const places = new Map<string, Promise<WeatherPlace | null>>();
  const placeOf = (key: string, find: () => Promise<WeatherPlace | null>) => {
    if (!places.has(key)) places.set(key, find().catch(() => null));
    return places.get(key)!;
  };
  const destinations = await Promise.all(
    coming.map(async (j) => {
      if (j.kind === "flight") {
        const airport = findAirport(j.destination);
        if (!airport) return null;
        return placeOf(`airport:${airport.iata}`, async () => ({
          name: airport.city ?? airport.name,
          detail: null,
          latitude: airport.latitude,
          longitude: airport.longitude,
        }));
      }
      const name = j.destinationCity ?? j.destination;
      return placeOf(`name:${name.toLowerCase()}`, async () => (await searchPlaces(name))[0] ?? null);
    })
  );

  // One forecast per place, long enough for its latest arrival; dates are
  // the place's own (timezone "auto"), like the arrival dates
  const daysNeeded = new Map<WeatherPlace, number>();
  coming.forEach((j, i) => {
    const place = destinations[i];
    if (!place) return;
    // One extra day: the destination's date can be a day ahead of the user's
    const days = daysBetween(today, j.arrivalDate ?? j.departureDate) + 2;
    daysNeeded.set(place, Math.max(daysNeeded.get(place) ?? 0, days));
  });
  const forecasts = new Map(
    [...daysNeeded].map(([place, days]) => [
      place,
      dailyForecast(place, null, Math.min(days, DAYS_AHEAD + 1)).catch(() => []),
    ])
  );

  const result: Record<string, JourneyWeather> = {};
  await Promise.all(
    coming.map(async (j, i) => {
      const place = destinations[i];
      if (!place) return;
      const day = j.arrivalDate ?? j.departureDate;
      const forecast = (await forecasts.get(place))?.find((d) => d.date === day);
      if (forecast) {
        result[j.id] = {
          place: place.name,
          date: day,
          code: forecast.code,
          conditions: forecast.conditions,
          high: forecast.high,
          low: forecast.low,
          precipitation: forecast.precipitation,
        };
      }
    })
  );
  return result;
}
