// app/settings/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchHolidayCountries, type Country } from "@/hooks/useHolidays";
import { useSettings, type SettingsInput } from "@/components/SettingsProvider";
import { SubscriptionSettings } from "@/components/calendar/SubscriptionSettings";
import { MAX_HOLIDAY_COUNTRIES } from "@/lib/calendar";
import {
  createFormatter,
  DATE_LOCALES,
  type DateLocale,
  type HourCycle,
  type WeekStart,
} from "@/lib/format";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Preferences for your Nestery.</p>
      </div>
      <section className="space-y-6 rounded-lg border bg-card p-5">
        <div>
          <h2 className="font-semibold">Date &amp; time</h2>
          <p className="text-sm text-muted-foreground">
            How dates and times are shown across Nestery, and which holidays appear.
          </p>
        </div>
        <FormatSettings />
        <div className="border-t" />
        <HolidaySettings />
      </section>

      <SubscriptionSettings />
    </div>
  );
}

// A fixed sample moment for the previews: Monday, September 28, 2026, 2:30 PM
const SAMPLE = new Date(2026, 8, 28, 14, 30);

function FormatSettings() {
  const { settings, loading, save } = useSettings();
  const { dateLocale, hourCycle, weekStart } = settings;

  const apply = async (input: SettingsInput) => {
    if (await save(input)) toast.success("Saved");
  };

  // Preview a candidate choice with the other settings unchanged
  const preview = (change: Partial<typeof settings>) =>
    createFormatter({ dateLocale, hourCycle, weekStart, ...change });

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <SettingSelect
        id="date-format"
        label="Date format"
        value={dateLocale}
        disabled={loading}
        onChange={(v) => apply({ dateLocale: v as DateLocale })}
        options={DATE_LOCALES.map(({ value, label }) => ({
          value,
          label,
          hint: preview({ dateLocale: value }).dayWithWeekday(SAMPLE),
        }))}
      />
      <SettingSelect
        id="time-format"
        label="Time format"
        value={hourCycle ?? "auto"}
        disabled={loading}
        onChange={(v) => apply({ hourCycle: v === "auto" ? null : (v as HourCycle) })}
        options={[
          { value: "auto", label: "Match date format", hint: preview({ hourCycle: null }).time(SAMPLE) },
          { value: "h12", label: "12-hour", hint: preview({ hourCycle: "h12" }).time(SAMPLE) },
          { value: "h23", label: "24-hour", hint: preview({ hourCycle: "h23" }).time(SAMPLE) },
        ]}
      />
      <SettingSelect
        id="week-start"
        label="Week starts on"
        value={String(weekStart)}
        disabled={loading}
        onChange={(v) => apply({ weekStart: Number(v) as WeekStart })}
        options={[
          { value: "1", label: "Monday" },
          { value: "0", label: "Sunday" },
        ]}
      />
    </div>
  );
}

function SettingSelect({
  id,
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string; hint?: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
              {o.hint && <span className="text-muted-foreground">· {o.hint}</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function HolidaySettings() {
  const { settings, loading, save, guessedCountries } = useSettings();
  const [countries, setCountries] = useState<Country[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchHolidayCountries()
      .then(setCountries)
      .catch(() => setLoadError(true));
  }, []);

  // Start from the saved choice, or the browser guess the calendar is using
  useEffect(() => {
    if (!loading && selected === null) {
      setSelected(settings.saved ? settings.holidayCountries : guessedCountries);
    }
  }, [loading, settings, guessedCountries, selected]);

  const chosen = selected ?? [];
  const nameOf = (code: string) => countries.find((c) => c.countryCode === code)?.name ?? code;
  const full = chosen.length >= MAX_HOLIDAY_COUNTRIES;
  const dirty =
    !loading && (!settings.saved || chosen.join() !== settings.holidayCountries.join());

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? countries.filter(
          (c) => c.name.toLowerCase().includes(q) || c.countryCode.toLowerCase() === q
        )
      : countries;
  }, [countries, query]);

  const toggle = (code: string) =>
    setSelected((prev) => {
      const list = prev ?? [];
      return list.includes(code) ? list.filter((c) => c !== code) : [...list, code];
    });

  const handleSave = async () => {
    setSaving(true);
    if (await save({ holidayCountries: chosen })) toast.success("Holiday countries saved");
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Public holidays</h3>
        <p className="text-sm text-muted-foreground">
          Holidays from these countries appear on your calendar and dashboard. Choose up to{" "}
          {MAX_HOLIDAY_COUNTRIES}.
        </p>
      </div>

      <div className="flex min-h-8 flex-wrap items-center gap-2" aria-live="polite">
        {chosen.length === 0 ? (
          <span className="text-sm text-muted-foreground">No countries selected.</span>
        ) : (
          chosen.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => toggle(code)}
              className="flex items-center gap-1 rounded-full bg-leaf-soft px-3 py-1 text-xs font-medium text-leaf"
              aria-label={`Remove ${nameOf(code)}`}
            >
              {nameOf(code)} <X className="size-3" />
            </button>
          ))
        )}
      </div>

      {loadError ? (
        <p className="text-sm text-destructive">Could not load the list of countries. Try again later.</p>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search countries"
              aria-label="Search countries"
              className="pl-9"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto rounded-md border" aria-label="Countries">
            {matches.map(({ countryCode, name }) => {
              const checked = chosen.includes(countryCode);
              return (
                <li key={countryCode}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted",
                      !checked && full && "cursor-not-allowed opacity-50 hover:bg-transparent"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && full}
                      onChange={() => toggle(countryCode)}
                      className="size-4 accent-leaf"
                    />
                    <span className="flex-1">{name}</span>
                    <span className="text-xs text-muted-foreground">{countryCode}</span>
                  </label>
                </li>
              );
            })}
            {countries.length > 0 && matches.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">No matching countries.</li>
            )}
          </ul>
        </>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
