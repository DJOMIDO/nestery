// src/server/weather.ts
// Forecasts and place search from Open-Meteo (free, no API key). Responses
// are cached by Next's fetch cache, so every dashboard load doesn't hit it.

import {
  weatherKind,
  weatherLabel,
  type TodayWeather,
  type WeatherPlace,
} from "@/lib/weather";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";

// Rain or snow counts as "likely" from this precipitation probability (%)
const WET_PROBABILITY = 50;

async function getJson<T>(url: URL, revalidate: number): Promise<T> {
  const res = await fetch(url, {
    next: { revalidate },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Weather service error (${res.status})`);
  return res.json() as Promise<T>;
}

interface ForecastResponse {
  current: { time: string; temperature_2m: number; weather_code: number; is_day: number };
  hourly: { time: string[]; weather_code: number[]; precipitation_probability: number[] };
  daily: { temperature_2m_max: number[]; temperature_2m_min: number[] };
}

// Today's weather at `place`, with times in `timeZone` (the user's zone, so
// "today" matches the rest of the dashboard)
export async function todayWeather(place: WeatherPlace, timeZone: string | null): Promise<TodayWeather> {
  const url = new URL(FORECAST_URL);
  url.search = new URLSearchParams({
    // Two decimals (~1 km) is plenty and lets nearby users share cache entries
    latitude: place.latitude.toFixed(2),
    longitude: place.longitude.toFixed(2),
    current: "temperature_2m,weather_code,is_day",
    hourly: "weather_code,precipitation_probability",
    daily: "temperature_2m_max,temperature_2m_min",
    timezone: timeZone ?? "auto",
    forecast_days: "1",
  }).toString();

  const data = await getJson<ForecastResponse>(url, 15 * 60);
  const { current, hourly, daily } = data;

  // The first hour from now on (the current one included) that looks wet
  const thisHour = current.time.slice(0, 13);
  let wetFrom: string | null = null;
  let wetKind: TodayWeather["wetKind"] = null;
  hourly.time.forEach((time, i) => {
    if (wetFrom || time.slice(0, 13) < thisHour) return;
    const kind = weatherKind(hourly.weather_code[i]);
    const wet = kind === "drizzle" || kind === "rain" || kind === "snow" || kind === "storm";
    if (wet && (hourly.precipitation_probability[i] ?? 0) >= WET_PROBABILITY) {
      wetFrom = time;
      wetKind = kind === "drizzle" ? "rain" : kind;
    }
  });

  return {
    place: place.name,
    current: {
      temperature: Math.round(current.temperature_2m),
      code: current.weather_code,
      isDay: current.is_day === 1,
    },
    high: Math.round(daily.temperature_2m_max[0]),
    low: Math.round(daily.temperature_2m_min[0]),
    wetFrom,
    wetKind,
  };
}

interface GeocodingResponse {
  results?: {
    name: string;
    latitude: number;
    longitude: number;
    admin1?: string;
    country?: string;
  }[];
}

// Places matching `query`, best first
export async function searchPlaces(query: string): Promise<WeatherPlace[]> {
  const url = new URL(GEOCODING_URL);
  url.search = new URLSearchParams({ name: query, count: "8", language: "en", format: "json" }).toString();

  const data = await getJson<GeocodingResponse>(url, 24 * 60 * 60);
  return (data.results ?? []).map((r) => ({
    name: r.name,
    detail: [r.admin1, r.country].filter(Boolean).join(", ") || null,
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

interface DailyResponse {
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
  };
}

export interface DailyForecast {
  date: string;
  code: number;
  conditions: string;
  high: number;
  low: number;
  // Highest chance of precipitation that day, in %
  precipitation: number | null;
}

// The next `days` days at `place` (today first), dated in `timeZone` (null:
// the place's own zone)
export async function dailyForecast(
  place: WeatherPlace,
  timeZone: string | null,
  days: number
): Promise<DailyForecast[]> {
  const url = new URL(FORECAST_URL);
  url.search = new URLSearchParams({
    latitude: place.latitude.toFixed(2),
    longitude: place.longitude.toFixed(2),
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: timeZone ?? "auto",
    forecast_days: String(days),
  }).toString();

  const { daily } = await getJson<DailyResponse>(url, 60 * 60);
  return daily.time.map((date, i) => ({
    date,
    code: daily.weather_code[i],
    conditions: weatherLabel(daily.weather_code[i]),
    high: Math.round(daily.temperature_2m_max[i]),
    low: Math.round(daily.temperature_2m_min[i]),
    precipitation: daily.precipitation_probability_max[i],
  }));
}
