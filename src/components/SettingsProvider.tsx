// src/components/SettingsProvider.tsx
// Loads the user's settings once for all signed-in pages and shares them,
// along with a date formatter built from the "Date & time" preferences.

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { request } from "@/lib/api";
import { guessHolidayCountries } from "@/lib/calendar";
import {
  createFormatter,
  DEFAULT_DATE_TIME,
  type DateTimePrefs,
  type Formatter,
} from "@/lib/format";

export interface Settings extends DateTimePrefs {
  holidayCountries: string[];
  // False until the user saves settings for the first time
  saved: boolean;
}

export type SettingsInput = Partial<Omit<Settings, "saved">>;

const DEFAULT_SETTINGS: Settings = { ...DEFAULT_DATE_TIME, holidayCountries: [], saved: false };

// Last known settings, so a reload starts in the user's format instead of
// flashing the defaults. Per browser only; the server copy is the source of truth.
const CACHE_KEY = "nestery-settings";

interface SettingsContextValue {
  settings: Settings;
  loading: boolean;
  save: (input: SettingsInput) => Promise<Settings | null>;
  format: Formatter;
  // Browser-language guess, used for holidays until the user saves a choice
  guessedCountries: string[];
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
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
      .then(remember)
      .catch((err) => toast.error((err as Error).message))
      .finally(() => setLoading(false));
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

  const { dateLocale, hourCycle, weekStart } = settings;
  const format = useMemo(
    () => createFormatter({ dateLocale, hourCycle, weekStart }),
    [dateLocale, hourCycle, weekStart]
  );

  return (
    <SettingsContext.Provider value={{ settings, loading, save, format, guessedCountries }}>
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
