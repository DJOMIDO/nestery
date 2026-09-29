// src/components/settings/HolidaySettings.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/components/SettingsProvider";
import { fetchHolidayRegions, type Region } from "@/hooks/useHolidays";
import { MAX_HOLIDAY_COUNTRIES } from "@/lib/calendar";
import { regionName } from "@/lib/regions";
import { cn } from "@/lib/utils";

// Which countries and regions' public holidays appear on the calendar
export function HolidaySettings() {
  const { settings, loading, save, guessedCountries } = useSettings();
  const [regions, setRegions] = useState<Region[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchHolidayRegions()
      .then(setRegions)
      .catch(() => setLoadError(true));
  }, []);

  // Start from the saved choice, or the browser guess the calendar is using
  useEffect(() => {
    if (!loading && selected === null) {
      setSelected(settings.saved ? settings.holidayCountries : guessedCountries);
    }
  }, [loading, settings, guessedCountries, selected]);

  const chosen = selected ?? [];
  const full = chosen.length >= MAX_HOLIDAY_COUNTRIES;
  const dirty = !loading && (!settings.saved || chosen.join() !== settings.holidayCountries.join());

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? regions.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase() === q) : regions;
  }, [regions, query]);

  const toggle = (code: string) =>
    setSelected((prev) => {
      const list = prev ?? [];
      return list.includes(code) ? list.filter((c) => c !== code) : [...list, code];
    });

  const handleSave = async () => {
    setSaving(true);
    if (await save({ holidayCountries: chosen })) toast.success("Holiday settings saved");
    setSaving(false);
  };

  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <div>
        <h2 className="font-semibold">Public holidays</h2>
        <p className="text-sm text-muted-foreground">
          Public holidays of the countries and regions you choose appear on your calendar and dashboard. Choose up to{" "}
          {MAX_HOLIDAY_COUNTRIES}.
        </p>
      </div>

      <div className="flex min-h-8 flex-wrap items-center gap-2" aria-live="polite">
        {chosen.length === 0 ? (
          <span className="text-sm text-muted-foreground">None selected.</span>
        ) : (
          chosen.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => toggle(code)}
              className="flex items-center gap-1 rounded-full bg-leaf-soft px-3 py-1 text-xs font-medium text-leaf"
              aria-label={`Remove ${regionName(code)}`}
            >
              {regionName(code)} <X className="size-3" />
            </button>
          ))
        )}
      </div>

      {loadError ? (
        <p className="text-sm text-destructive">Could not load the list. Try again later.</p>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search countries and regions"
              aria-label="Search countries and regions"
              className="pl-9"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto rounded-md border" aria-label="Countries and regions">
            {matches.map(({ code, name, available }) => {
              const checked = chosen.includes(code);
              // Unavailable ones stay listed so the list is complete, but can't be picked
              const disabled = !checked && (!available || full);
              return (
                <li key={code}>
                  <label
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm",
                      disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggle(code)}
                      className="size-4 accent-leaf"
                    />
                    <span className="flex-1">{name}</span>
                    {!available && <span className="text-xs text-muted-foreground">No holiday data</span>}
                    <span className="w-6 text-right text-xs text-muted-foreground">{code}</span>
                  </label>
                </li>
              );
            })}
            {regions.length > 0 && matches.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">No matches.</li>
            )}
          </ul>
        </>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Holiday data from{" "}
          <a
            href="https://github.com/commenthol/date-holidays"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            date-holidays
          </a>{" "}
          (
          <a
            href="https://creativecommons.org/licenses/by/3.0/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            CC BY 3.0
          </a>
          ). Nationwide public holidays only.
        </p>
        <Button onClick={handleSave} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </section>
  );
}
