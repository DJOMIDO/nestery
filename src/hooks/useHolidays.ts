// src/hooks/useHolidays.ts

import { useEffect, useState } from "react";
import { request } from "@/lib/api";
import type { Holiday } from "@/lib/calendar";
import { REGION_CODES, regionName } from "@/lib/regions";

// One request per country and year for the whole session
const cache = new Map<string, Promise<Holiday[]>>();

function fetchHolidays(country: string, year: number) {
  const key = `${country}-${year}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = request<Holiday[]>(`/api/holidays?countries=${country}&years=${year}`).catch(() => {
      cache.delete(key); // retry next time
      return [];
    });
    cache.set(key, pending);
  }
  return pending;
}

// Nationwide public holidays for the given countries/regions and years,
// sorted by date. Failures just leave those holidays out.
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

export interface Region {
  code: string;
  name: string;
  // Whether holiday data exists for it
  available: boolean;
}

// Every country and region, sorted by name, marking the ones with holiday data
export async function fetchHolidayRegions(): Promise<Region[]> {
  const withData = new Set(await request<string[]>("/api/holidays/regions"));
  return REGION_CODES.map((code) => ({ code, name: regionName(code), available: withData.has(code) })).sort(
    (a, b) => a.name.localeCompare(b.name)
  );
}
