// src/hooks/useHolidays.ts

import { useEffect, useState } from "react";
import type { Holiday } from "@/lib/calendar";

const API = "https://date.nager.at/api/v3";

// One request per country and year for the whole session
const cache = new Map<string, Promise<Holiday[]>>();

function fetchHolidays(country: string, year: number) {
  const key = `${country}-${year}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = fetch(`${API}/PublicHolidays/${year}/${country}`)
      .then((res) => (res.ok ? (res.json() as Promise<(Holiday & { global: boolean })[]>) : []))
      // Nationwide holidays only; regional ones (e.g. Alsace, German states) would clutter the calendar
      .then((list) =>
        list
          .filter((h) => h.global)
          .map(({ date, localName, name }) => ({ date, localName, name, countryCode: country }))
      )
      .catch(() => {
        cache.delete(key); // retry next time
        return [];
      });
    cache.set(key, pending);
  }
  return pending;
}

// Public holidays for the given countries and years, sorted by date.
// Failures (unknown country, network) just leave those holidays out.
export function useHolidays(countries: string[], years: number[]) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const key = `${countries.join(",")}|${years.join(",")}`;

  useEffect(() => {
    let cancelled = false;
    const [codes, yearList] = key.split("|").map((part) => part.split(",").filter(Boolean));
    Promise.all(codes.flatMap((c) => yearList.map((y) => fetchHolidays(c, Number(y))))).then(
      (lists) => {
        if (!cancelled) setHolidays(lists.flat().sort((a, b) => a.date.localeCompare(b.date)));
      }
    );
    return () => {
      cancelled = true;
    };
  }, [key]);

  return holidays;
}

export interface Country {
  countryCode: string;
  name: string;
}

// Countries that have holiday data, for the Settings picker
export async function fetchHolidayCountries(): Promise<Country[]> {
  const res = await fetch(`${API}/AvailableCountries`);
  if (!res.ok) throw new Error("Could not load the list of countries");
  const list = (await res.json()) as Country[];
  return list.sort((a, b) => a.name.localeCompare(b.name));
}
