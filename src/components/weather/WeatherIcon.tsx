// src/components/weather/WeatherIcon.tsx

import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { weatherKind, weatherLabel, type WeatherKind } from "@/lib/weather";

const ICONS: Record<WeatherKind, LucideIcon> = {
  clear: Sun,
  partly: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

// Icon for a WMO weather code, with a moon at night for clear skies
export function WeatherIcon({ code, isDay = true, className }: { code: number; isDay?: boolean; className?: string }) {
  const kind = weatherKind(code);
  const Icon = !isDay && kind === "clear" ? Moon : !isDay && kind === "partly" ? CloudMoon : ICONS[kind];
  return <Icon className={className} role="img" aria-label={weatherLabel(code)} />;
}
