// src/hooks/useWeather.ts

import { useEffect, useState } from "react";
import { useSettings } from "@/components/SettingsProvider";
import { request } from "@/lib/api";
import type { TodayWeather } from "@/lib/weather";
import type { DailyForecast } from "@/server/weather";

// Today's weather at the place chosen in Settings. `weather` is null when no
// place is set (`needsPlace`) or the forecast could not be loaded.
export function useWeather() {
  const { settings, loading } = useSettings();
  const [weather, setWeather] = useState<TodayWeather | null>(null);
  const place = settings.weatherPlace;
  // Refetch when the chosen place changes
  const placeKey = place ? `${place.latitude},${place.longitude}` : "";

  useEffect(() => {
    if (!placeKey) {
      setWeather(null);
      return;
    }
    let cancelled = false;
    request<TodayWeather | null>("/api/weather")
      .then((next) => !cancelled && setWeather(next))
      .catch(() => !cancelled && setWeather(null));
    return () => {
      cancelled = true;
    };
  }, [placeKey]);

  return { weather, needsPlace: !loading && !place };
}

// The next two weeks' forecast at the place chosen in Settings, by date, or
// null (no place set, or not loaded)
export function useWeatherDays() {
  const { settings } = useSettings();
  const [forecast, setForecast] = useState<{ place: string; days: Map<string, DailyForecast> } | null>(null);
  const place = settings.weatherPlace;
  const placeKey = place ? `${place.latitude},${place.longitude}` : "";

  useEffect(() => {
    if (!placeKey) {
      setForecast(null);
      return;
    }
    let cancelled = false;
    request<{ place: string; days: DailyForecast[] } | null>("/api/weather/days")
      .then((next) => !cancelled && setForecast(next && { place: next.place, days: new Map(next.days.map((d) => [d.date, d])) }))
      // Weather is extra; the calendar works without it
      .catch(() => !cancelled && setForecast(null));
    return () => {
      cancelled = true;
    };
  }, [placeKey]);

  return forecast;
}
