// src/lib/weather.ts
// Weather types and helpers shared by the server, the dashboard and Settings.
// Data comes from Open-Meteo; keep this file free of server-only imports.

import { z } from "zod";

// A place chosen in Settings > Weather (from Open-Meteo's geocoding search)
export const weatherPlaceSchema = z.object({
  name: z.string().min(1).max(100),
  // Region and country, e.g. "Île-de-France, France"; only for display
  detail: z.string().max(200).nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type WeatherPlace = z.infer<typeof weatherPlaceSchema>;

export const describePlace = (place: WeatherPlace) =>
  place.detail ? `${place.name}, ${place.detail}` : place.name;

// What the dashboard needs for today, in the user's time zone
export interface TodayWeather {
  place: string;
  // °C, rounded
  current: { temperature: number; code: number; isDay: boolean };
  high: number;
  low: number;
  // First hour later today when rain or snow is likely, as a local
  // "YYYY-MM-DDTHH:mm" timestamp; null when the rest of the day looks dry
  wetFrom: string | null;
  wetKind: "rain" | "snow" | "storm" | null;
}

// WMO weather interpretation codes, as used by Open-Meteo
const LABELS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Dense freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Heavy showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with heavy hail",
};

export const weatherLabel = (code: number) => LABELS[code] ?? "Unknown";

export type WeatherKind = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";

export function weatherKind(code: number): WeatherKind {
  if (code <= 1) return "clear";
  if (code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  return "storm";
}
