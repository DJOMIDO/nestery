// src/components/dashboard/DateCard.tsx

"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { usePublicHolidays, Holiday } from "@/lib/usePublicHolidays";

export function DateCard() {
  const [today] = useState(new Date());
  const holidays = usePublicHolidays();
  const upcoming = holidays
    .filter((h) => new Date(h.date) >= today)
    .slice(0, 2);

  const weekday = today
    .toLocaleDateString("en-US", { weekday: "short" })
    .toUpperCase();
  const dayNum = today.getDate();

  return (
    <Card
      className={`
        w-full
        hover:shadow-md hover:bg-indigo-50 dark:hover:bg-gray-700
        bg-white dark:bg-gray-800
      `}
    >
      <CardContent className="p-4 flex flex-col md:flex-row md:space-x-4 space-y-4 md:space-y-0">
        <div className="flex flex-col items-center flex-shrink-0 min-w-0">
          <p className="text-xl font-bold text-rose-500">{weekday}</p>
          <p className="text-5xl font-extrabold">{dayNum}</p>
        </div>

        <div className="flex-1 min-w-0">
          {upcoming.length > 0 ? (
            upcoming.map((h: Holiday) => (
              <div key={h.date} className="mb-3">
                <p className="text-xs uppercase text-muted-foreground">
                  {new Date(h.date)
                    .toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })
                    .toUpperCase()}
                </p>
                <p className="inline-block text-indigo-600 bg-indigo-100 px-2 py-1 rounded text-sm font-medium">
                  {h.localName}
                </p>
              </div>
            ))
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-base font-medium text-muted-foreground">
                No upcoming events
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
