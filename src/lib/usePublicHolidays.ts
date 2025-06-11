// src/lib/usePublicHolidays.ts

import { useEffect, useState } from "react";

export interface Holiday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  type: string;
}

export function usePublicHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  useEffect(() => {
    
    const lang = navigator.language || "en-US";
    const country = lang.split("-")[1] ?? "US";

    const year = new Date().getFullYear();

    fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch holidays");
        return res.json();
      })
      .then((data: Holiday[]) => {

        data.sort((a, b) => (a.date > b.date ? 1 : -1));
        setHolidays(data);
      })
      .catch(console.error);
  }, []);

  return holidays;
}
