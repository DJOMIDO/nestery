// src/components/travel/JourneyWeatherBadge.tsx
// The forecast at a journey's destination on arrival, e.g. "☁ 24°/17°".

import { WeatherIcon } from "@/components/weather/WeatherIcon";
import type { JourneyWeather } from "@/lib/travel";
import { cn } from "@/lib/utils";

export function JourneyWeatherBadge({ weather, className }: { weather: JourneyWeather; className?: string }) {
  const rain = weather.precipitation !== null && weather.precipitation >= 30 ? `, ${weather.precipitation}% chance of rain` : "";
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}
      title={`${weather.conditions} in ${weather.place}${rain}`}
    >
      <WeatherIcon code={weather.code} className="size-3.5 shrink-0 text-leaf" />
      {weather.high}°/{weather.low}°
    </span>
  );
}
