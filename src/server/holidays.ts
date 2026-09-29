// src/server/holidays.ts
// Public holidays from date-holidays, a rule-based dataset that runs offline
// on the server (data CC BY 3.0, see the credit on the Settings page).

import Holidays from "date-holidays";
import type { Holiday } from "@/lib/calendar";

const provider = new Holidays();

// Codes of the countries and regions that have holiday data
export const HOLIDAY_REGIONS = Object.keys(provider.getCountries("en")).sort();
const available = new Set(HOLIDAY_REGIONS);

// Nationwide public holidays for the given regions and years, by date.
// Unknown codes are skipped.
export function publicHolidays(regions: string[], years: number[]): Holiday[] {
  const result: Holiday[] = [];
  for (const code of regions) {
    if (!available.has(code)) continue;
    const local = new Holidays(code, { types: ["public"] });
    const english = new Holidays(code, { types: ["public"] });
    for (const year of years) {
      // Local names in the region's own language, plus English names,
      // matched by date and rule
      const key = (h: { date: string; rule: string }) => `${h.date}|${h.rule}`;
      const englishNames = new Map(english.getHolidays(year, "en").map((h) => [key(h), h.name]));
      for (const h of local.getHolidays(year)) {
        if (h.type !== "public") continue;
        result.push({
          date: h.date.slice(0, 10),
          localName: h.name,
          name: englishNames.get(key(h)) ?? h.name,
          countryCode: code,
        });
      }
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date) || a.countryCode.localeCompare(b.countryCode));
}
