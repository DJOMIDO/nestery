// src/lib/format.ts
// Date and time formatting that follows the user's "Date & time" settings.
// The UI text stays English; only how dates and times are written changes.

export const DATE_LOCALES = [
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "fr-FR", label: "Français" },
  { value: "zh-CN", label: "中文" },
] as const;

export type DateLocale = (typeof DATE_LOCALES)[number]["value"];
// h12: "2:30 PM", h23: "14:30"; null follows the date locale
export type HourCycle = "h12" | "h23";
// 0 = Sunday, 1 = Monday
export type WeekStart = 0 | 1;

export interface DateTimePrefs {
  dateLocale: DateLocale;
  hourCycle: HourCycle | null;
  weekStart: WeekStart;
}

export const DEFAULT_DATE_TIME: DateTimePrefs = {
  dateLocale: "en-US",
  hourCycle: null,
  weekStart: 1,
};

type DateInput = string | Date;

// "YYYY-MM-DD" is a local calendar day; anything else is a timestamp
const toDate = (d: DateInput) =>
  d instanceof Date ? d : d.length === 10 ? new Date(`${d}T00:00`) : new Date(d);

export function createFormatter({ dateLocale, hourCycle, weekStart }: DateTimePrefs) {
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
