// src/components/travel/JourneyWeatherBadge.tsx
// The forecast at a journey's destination on arrival, e.g. "☁ 24°/17°".
"use client";

import { useTranslations } from "next-intl";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { useWeatherLabel } from "@/components/weather/useWeatherLabel";
import type { JourneyWeather } from "@/lib/travel";
import { cn } from "@/lib/utils";

export function JourneyWeatherBadge({ weather, className }: { weather: JourneyWeather; className?: string }) {
  const t = useTranslations("travel");
  const weatherLabel = useWeatherLabel();
  const rain =
    weather.precipitation !== null && weather.precipitation >= 30
      ? t("rainChance", { percent: weather.precipitation })
      : "";
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}
      title={t("weather", { conditions: weatherLabel(weather.code), place: weather.place }) + rain}
    >
      <WeatherIcon code={weather.code} className="size-3.5 shrink-0 text-leaf" />
      {weather.high}°/{weather.low}°
    </span>
  );
}
