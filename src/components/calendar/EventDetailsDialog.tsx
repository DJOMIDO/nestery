// src/components/calendar/EventDetailsDialog.tsx
"use client";

import { useTranslations } from "next-intl";
import { useWeatherLabel } from "@/components/weather/useWeatherLabel";
import Link from "next/link";
import { CalendarClock, MapPin, Plane, Rss } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { eventWhen } from "@/components/calendar/CalendarItemView";
import { JourneyWeatherBadge } from "@/components/travel/JourneyWeatherBadge";
import { useJourneyWeather } from "@/hooks/useJourneys";
import { useFormat } from "@/components/SettingsProvider";
import type { CalendarEvent } from "@/lib/calendar";
import { SUBSCRIPTION_COLORS } from "@/lib/subscriptions";
import { cn } from "@/lib/utils";

interface EventDetailsDialogProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Read-only view of an event from a subscribed calendar, or of a journey
// from Travel (edited there)
export function EventDetailsDialog({ event, open, onOpenChange }: EventDetailsDialogProps) {
  const format = useFormat();
  const t = useTranslations("calendar");
  const tTravel = useTranslations("travel");
  const tCommon = useTranslations("common");
  const weatherLabel = useWeatherLabel();
  const source = event?.source;
  // Journeys: the forecast at the destination, loaded when one is opened
  const journeyId = open ? source?.journeyId : undefined;
  // At the destination on arrival
  const weather = useJourneyWeather(journeyId ?? "", !!journeyId)[journeyId ?? ""]?.arrival;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {event && source && (
          <>
            <DialogHeader>
              <DialogTitle className="break-words">{event.title}</DialogTitle>
              <DialogDescription className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", SUBSCRIPTION_COLORS[source.color].dot)} />
                {source.journeyId ? t("details.fromTravel") : t("details.fromCalendar", { name: source.name })}
              </DialogDescription>
            </DialogHeader>

            <div className="min-w-0 space-y-2 text-sm">
              <p className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  {format.dayWithWeekday(event.allDay ? event.startDate! : event.startsAt!)} ·{" "}
                  {eventWhen(event, format, t("allDay"))}
                </span>
              </p>
              {source.location && (
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 wrap-anywhere">{source.location}</span>
                </p>
              )}
              {weather && (
                <p className="flex items-center gap-2 pl-6">
                  <JourneyWeatherBadge weather={weather} />
                  <span className="text-xs text-muted-foreground">
                    {tTravel("weatherOnArrival", { conditions: weatherLabel(weather.code), place: weather.place })}
                  </span>
                </p>
              )}
              {event.notes && (
                <p className="max-h-48 overflow-y-auto whitespace-pre-wrap wrap-anywhere rounded-md bg-muted/50 p-3 text-muted-foreground">
                  {event.notes}
                </p>
              )}
              {!source.journeyId && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Rss className="size-3.5" />
                  {t("details.sourceNote")}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              {source.journeyId && (
                <Button variant="outline" asChild>
                  <Link href={`/travel?journey=${source.journeyId}`}>
                    <Plane className="mr-1 size-4" /> {t("details.openInTravel")}
                  </Link>
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon("close")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
