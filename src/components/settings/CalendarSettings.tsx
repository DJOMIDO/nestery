// src/components/settings/CalendarSettings.tsx
// Settings > Calendar: public holidays, calendars brought into Nestery
// (subscriptions and .ics files) and the link that shows Nestery elsewhere.

"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { CalendarFeedSettings } from "@/components/calendar/CalendarTransferSettings";
import { SubscriptionSettings } from "@/components/calendar/SubscriptionSettings";
import { HolidaySettings } from "@/components/settings/HolidaySettings";

// Parts of this section, by the anchor of their card (labels in messages:
// calendarSettings.parts.<id>)
export const CALENDAR_PARTS = ["holidays", "calendars", "share"] as const;

export type CalendarPart = (typeof CALENDAR_PARTS)[number];

const scrollTo = (part: CalendarPart) =>
  document.getElementById(`calendar-${part}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

export function CalendarSettings({ focus }: { focus?: CalendarPart | null }) {
  const t = useTranslations("calendarSettings");
  // Links such as ?section=calendar&focus=holidays land on that part
  useEffect(() => {
    if (focus) scrollTo(focus);
  }, [focus]);

  return (
    <div className="space-y-4">
      <nav aria-label={t("onThisPage")} className="flex flex-wrap gap-2">
        {CALENDAR_PARTS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => scrollTo(id)}
            className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {t(`parts.${id}`)}
          </button>
        ))}
      </nav>
      <HolidaySettings />
      <SubscriptionSettings />
      <CalendarFeedSettings />
    </div>
  );
}
