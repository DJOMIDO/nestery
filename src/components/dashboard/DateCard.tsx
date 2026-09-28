// src/components/dashboard/DateCard.tsx

"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { usePublicHolidays, Holiday } from "@/lib/usePublicHolidays";
import { CardHeading } from "./CardHeading";

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
    <Card className="w-full h-full rounded-lg shadow-sm bg-card hover:shadow-md">
      <CardContent className="p-4">
        <CardHeading title="Calendar" icon={CalendarDays} />

        <div className="flex items-start space-x-4">
          <div className="flex flex-col items-center flex-shrink-0">
            <p className="text-sm font-bold text-bark">{weekday}</p>
            <p className="text-4xl font-extrabold leading-none">{dayNum}</p>
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            {upcoming.length > 0 ? (
              upcoming.map((h: Holiday) => (
                <div key={h.date}>
                  <p className="text-xs uppercase text-muted-foreground mb-1">
                    {new Date(h.date)
                      .toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })
                      .toUpperCase()}
                  </p>
                  <p className="inline-block max-w-full truncate text-leaf bg-leaf-soft px-2 py-1 rounded text-sm font-medium">
                    {h.localName}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming holidays.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
