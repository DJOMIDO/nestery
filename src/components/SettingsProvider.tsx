// src/components/SettingsProvider.tsx
// Loads the user's settings once for all signed-in pages and shares them,
// along with a date formatter built from the "Language & time" preferences.

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from "@/i18n/config";
import { request } from "@/lib/api";
import { guessHolidayCountries } from "@/lib/calendar";
import {
  createFormatter,
  DEFAULT_DATE_TIME,
  type DateTimePrefs,
  type Formatter,
} from "@/lib/format";
import type { WeatherPlace } from "@/lib/weather";

export interface Settings extends DateTimePrefs {
  // Interface language; null follows the browser
  language: Locale | null;
  holidayCountries: string[];
  // IANA zone, kept in sync with the browser (the calendar feed uses it)
  timeZone: string | null;
  // Place for the dashboard's weather; null until chosen in Settings
  weatherPlace: WeatherPlace | null;
  // Secret of the calendar feed URL; null when the feed is off
  feedToken: string | null;
  // False until the user saves settings for the first time
  saved: boolean;
}

export type SettingsInput = Partial<Omit<Settings, "saved" | "feedToken">>;

const DEFAULT_SETTINGS: Settings = {
  ...DEFAULT_DATE_TIME,
  language: null,
  holidayCountries: [],
  timeZone: null,
  weatherPlace: null,
  feedToken: null,
  saved: false,
};

// Last known settings, so a reload starts in the user's format instead of
// flashing the defaults. Per browser only; the server copy is the source of truth.
const CACHE_KEY = "nestery-settings";

// The page's language comes from the NEXT_LOCALE cookie (src/i18n/request.ts).
// Signed in on a new browser, the cookie doesn't hold the saved language yet:
// set it and render again (returns true). Without a saved language, a choice
// made before signing in (the picker on the sign-in pages) becomes the
// account's (returns the language to save).
function syncLanguageCookie(saved: Locale | null, current: Locale): boolean | Locale {
  const cookie = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`))?.[1] ?? null;
  if (saved && saved !== current) {
    document.cookie = `${LOCALE_COOKIE}=${saved}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    return true;
  }
  if (!saved && isLocale(cookie)) return cookie;
  return false;
}

interface SettingsContextValue {
  settings: Settings;
  loading: boolean;
  save: (input: SettingsInput) => Promise<Settings | null>;
  // Turn the calendar feed on (with a new link) or off
  setFeed: (on: boolean) => Promise<Settings | null>;
  format: Formatter;
  // Browser-language guess, used for holidays until the user saves a choice
  guessedCountries: string[];
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const locale = useLocale();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [guessedCountries, setGuessedCountries] = useState<string[]>([]);

  const remember = (next: Settings) => {
    setSettings(next);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
    } catch {}
  };

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(cached) });
    } catch {}
    setGuessedCountries(guessHolidayCountries(navigator.languages ?? [navigator.language]));

    request<Settings>("/api/settings")
      .then(async (loaded) => {
        remember(loaded);
        const sync = syncLanguageCookie(loaded.language, locale);
        if (sync === true) router.refresh();
        else if (sync) {
          // Quietly; the page is already in this language
          request<Settings>("/api/settings", { method: "PATCH", body: JSON.stringify({ language: sync }) })
            .then(remember)
            .catch(() => {});
        }
        // Keep the stored zone in sync with this browser, quietly
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (zone && zone !== loaded.timeZone) {
          const next = await request<Settings>("/api/settings", {
            method: "PATCH",
            body: JSON.stringify({ timeZone: zone }),
          }).catch(() => null);
          if (next) remember(next);
        }
      })
      .catch((err) => toast.error((err as Error).message))
      .finally(() => setLoading(false));
    // Once per page load; a language change in Settings refreshes the page itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useCallback(async (input: SettingsInput) => {
    try {
      const next = await request<Settings>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      remember(next);
      return next;
    } catch (err) {
      toast.error((err as Error).message);
      return null;
    }
  }, []);

  const setFeed = useCallback(async (on: boolean) => {
    try {
      const next = await request<Settings>("/api/calendar/feed-token", { method: on ? "POST" : "DELETE" });
      remember(next);
      return next;
    } catch (err) {
      toast.error((err as Error).message);
      return null;
    }
  }, []);

  const { dateLocale, hourCycle, weekStart } = settings;
  const format = useMemo(
    () => createFormatter({ dateLocale, hourCycle, weekStart }, locale),
    [dateLocale, hourCycle, weekStart, locale]
  );

  return (
    <SettingsContext.Provider value={{ settings, loading, save, setFeed, format, guessedCountries }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const value = useContext(SettingsContext);
  if (!value) throw new Error("useSettings must be used inside SettingsProvider");
  return value;
}

// Date formatter following the user's settings
export const useFormat = () => useSettings().format;

// Holiday countries to show: the saved ones, or the browser guess until the
// user has saved settings. `guessed` lets the UI suggest visiting Settings.
export function useHolidayCountries() {
  const { settings, loading, guessedCountries } = useSettings();
  if (loading && !settings.saved) return { countries: [], guessed: false };
  return settings.saved
    ? { countries: settings.holidayCountries, guessed: false }
    : { countries: guessedCountries, guessed: true };
}
