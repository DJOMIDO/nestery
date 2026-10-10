// src/components/settings/WeatherSettings.tsx
"use client";

import { useEffect, useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/components/SettingsProvider";
import { request } from "@/lib/api";
import { describePlace, type WeatherPlace } from "@/lib/weather";

// Wait this long after typing stops before searching
const SEARCH_DELAY_MS = 300;

// The place whose weather appears on the dashboard
export function WeatherSettings() {
  const { settings, loading, save } = useSettings();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WeatherPlace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setError(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      request<WeatherPlace[]>(`/api/weather/places?q=${encodeURIComponent(q)}`)
        .then((places) => {
          if (cancelled) return;
          setResults(places);
          setError(null);
        })
        .catch((err) => !cancelled && setError((err as Error).message));
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const choose = async (place: WeatherPlace | null) => {
    setSaving(true);
    if (await save({ weatherPlace: place })) {
      toast.success(place ? `Weather set to ${place.name}` : "Weather location removed");
      setQuery("");
    }
    setSaving(false);
  };

  const current = settings.weatherPlace;

  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <div>
        <h2 className="font-semibold">Weather</h2>
        <p className="text-sm text-muted-foreground">
          The place whose weather appears on your dashboard&apos;s Today card.
        </p>
      </div>

      {!loading && (
        <div className="flex min-h-8 items-center gap-2 text-sm" aria-live="polite">
          {current ? (
            <>
              <MapPin className="size-4 shrink-0 text-leaf" />
              <span className="flex-1 truncate">{describePlace(current)}</span>
              <Button variant="ghost" size="sm" onClick={() => choose(null)} disabled={saving}>
                <X className="size-4 mr-1" /> Remove
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground">No place chosen.</span>
          )}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={current ? "Search for another city" : "Search for a city"}
          aria-label="Search for a city"
          className="pl-9"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {results && !error && (
        <ul className="max-h-72 overflow-y-auto rounded-md border" aria-label="Matching places">
          {results.map((place) => (
            <li key={`${place.latitude},${place.longitude}`}>
              <button
                type="button"
                onClick={() => choose(place)}
                disabled={saving}
                className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
              >
                <span className="font-medium">{place.name}</span>
                {place.detail && <span className="truncate text-xs text-muted-foreground">{place.detail}</span>}
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No matches.</li>}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Weather data by{" "}
        <a
          href="https://open-meteo.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Open-Meteo
        </a>{" "}
        (
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          CC BY 4.0
        </a>
        ).
      </p>
    </section>
  );
}
