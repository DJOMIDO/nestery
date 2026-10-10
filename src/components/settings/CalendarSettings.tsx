// src/components/settings/CalendarSettings.tsx
// Settings > Calendar: public holidays, calendars brought into Nestery
// (subscriptions and .ics files) and the link that shows Nestery elsewhere.

"use client";

import { useEffect } from "react";
import { CalendarFeedSettings } from "@/components/calendar/CalendarTransferSettings";
import { SubscriptionSettings } from "@/components/calendar/SubscriptionSettings";
import { HolidaySettings } from "@/components/settings/HolidaySettings";

// Parts of this section, by the anchor of their card
export const CALENDAR_PARTS = [
  { id: "holidays", label: "Public holidays" },
  { id: "calendars", label: "Other calendars" },
  { id: "share", label: "Nestery in other apps" },
] as const;

export type CalendarPart = (typeof CALENDAR_PARTS)[number]["id"];

const scrollTo = (part: CalendarPart) =>
  document.getElementById(`calendar-${part}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

export function CalendarSettings({ focus }: { focus?: CalendarPart | null }) {
  // Links such as ?section=calendar&focus=holidays land on that part
  useEffect(() => {
    if (focus) scrollTo(focus);
  }, [focus]);

  return (
    <div className="space-y-4">
      <nav aria-label="On this page" className="flex flex-wrap gap-2">
        {CALENDAR_PARTS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => scrollTo(id)}
            className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {label}
          </button>
        ))}
      </nav>
      <HolidaySettings />
      <SubscriptionSettings />
      <CalendarFeedSettings />
    </div>
  );
}
