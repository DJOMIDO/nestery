// src/components/weather/useWeatherLabel.ts

import { useTranslations } from "next-intl";

// "Light rain" for a WMO weather code, in the interface language
export function useWeatherLabel() {
  const t = useTranslations("weather.codes");
  return (code: number) => {
    const key = String(code) as "0";
    return t.has(key) ? t(key) : t("unknown");
  };
}
