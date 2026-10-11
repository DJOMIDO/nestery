// src/lib/format.ts
// Date and time formatting that follows the user's "Language & time"
// settings: by default dates are written the way the interface language
// writes them, unless the user picks another date format.

import type { Locale } from "@/i18n/config";

export const DATE_LOCALES = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "fr-FR", label: "Français" },
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-TW", label: "繁體中文" },
] as const;

export type DateLocale = (typeof DATE_LOCALES)[number]["value"];

// The date format of each interface language
export const DATE_LOCALE_OF: Record<Locale, DateLocale> = {
  en: "en-US",
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW",
  fr: "fr-FR",
};
// h12: "2:30 PM", h23: "14:30"; null follows the date locale
export type HourCycle = "h12" | "h23";
// 0 = Sunday, 1 = Monday
export type WeekStart = 0 | 1;

export interface DateTimePrefs {
  // null follows the interface language
  dateLocale: DateLocale | null;
  hourCycle: HourCycle | null;
  weekStart: WeekStart;
}

export const DEFAULT_DATE_TIME: DateTimePrefs = {
  dateLocale: null,
  hourCycle: null,
  weekStart: 1,
};

type DateInput = string | Date;

// "YYYY-MM-DD" is a local calendar day; anything else is a timestamp
const toDate = (d: DateInput) =>
  d instanceof Date ? d : d.length === 10 ? new Date(`${d}T00:00`) : new Date(d);

// `locale`: the interface language, for a dateLocale that follows it
export function createFormatter({ dateLocale: chosen, hourCycle, weekStart }: DateTimePrefs, locale: Locale) {
  const dateLocale = chosen ?? DATE_LOCALE_OF[locale];
  // Words like "yesterday" are interface text, so in the interface language
  const relativeFormat = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const date = (d: DateInput, options: Intl.DateTimeFormatOptions) =>
    toDate(d).toLocaleDateString(dateLocale, options);
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    ...(hourCycle && { hourCycle }),
  };

  return {
    // Sep 28 · 28 Sep · 28 sept. · 9月28日
    day: (d: DateInput) => date(d, { month: "short", day: "numeric" }),
    // Sep 28, 2025 (for dates outside the current year)
    dayWithYear: (d: DateInput) => date(d, { month: "short", day: "numeric", year: "numeric" }),
    // Mon, Sep 28
    dayWithWeekday: (d: DateInput) => date(d, { weekday: "short", month: "short", day: "numeric" }),
    // Monday, September 28
    dayLong: (d: DateInput) => date(d, { weekday: "long", month: "long", day: "numeric" }),
    // September 2026
    monthYear: (d: DateInput) => date(d, { month: "long", year: "numeric" }),
    // Mon · lun. · 周一
    weekday: (d: DateInput) => date(d, { weekday: "short" }),
    // 2:30 PM · 14:30
    time: (d: DateInput) => toDate(d).toLocaleTimeString(dateLocale, timeOptions),
    // Sep 28, 2:30 PM
    dayTime: (d: DateInput) =>
      toDate(d).toLocaleString(dateLocale, { month: "short", day: "numeric", ...timeOptions }),
    // "now", "5 minutes ago", "yesterday", "3 days ago", then the date
    relative: (iso: string, now = new Date()) => {
      const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
      const abs = Math.abs(seconds);
      if (abs < 60) return relativeFormat.format(0, "second");
      if (abs < 3600) return relativeFormat.format(Math.round(seconds / 60), "minute");
      if (abs < 86400) return relativeFormat.format(Math.round(seconds / 3600), "hour");
      if (abs < 7 * 86400) return relativeFormat.format(Math.round(seconds / 86400), "day");
      return date(iso, { month: "short", day: "numeric" });
    },
    weekStart,
    // Column headers for a week, starting on the configured day
    weekdayNames: (style: "short" | "narrow") =>
      Array.from({ length: 7 }, (_, i) =>
        // 2024-01-07 is a Sunday
        new Date(2024, 0, 7 + ((weekStart + i) % 7)).toLocaleDateString(dateLocale, { weekday: style })
      ),
  };
}

export type Formatter = ReturnType<typeof createFormatter>;
