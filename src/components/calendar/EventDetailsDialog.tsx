// src/components/calendar/EventDetailsDialog.tsx
// What opens on an event: when it is, how long, how it repeats, where, its
// link, notes and the weather that day. The user's own events can be edited
// or deleted from here; subscribed calendars' are read-only, and journeys
// from Travel are edited there.
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { CalendarClock, ExternalLink, Mail, MapPin, Pencil, Phone, Plane, Repeat, Rss, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { eventWhen, useEventDuration } from "@/components/calendar/CalendarItemView";
import { EventLinkButton } from "@/components/calendar/EventLinkList";
import { useDescribeRule } from "@/components/calendar/useDescribeRule";
import type { EditScope } from "@/components/calendar/EventDialog";
import { useFormat } from "@/components/SettingsProvider";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { useWeatherLabel } from "@/components/weather/useWeatherLabel";
import { useJourneyWeather } from "@/hooks/useJourneys";
import { eventDays, type CalendarEvent } from "@/lib/calendar";
import { contactsIn, linkify, mapsUrl } from "@/lib/eventContacts";
import { useIsMac } from "@/hooks/useShortcut";
import { eventLink } from "@/lib/meetingLinks";
import { parseRRule } from "@/lib/recurrence";
import { SUBSCRIPTION_COLORS } from "@/lib/subscriptions";
import type { PlaceWeather } from "@/lib/travel";
import { cn } from "@/lib/utils";
import type { DailyForecast } from "@/server/weather";

interface EventDetailsDialogProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The forecast at the user's place, by date (see useWeatherDays)
  forecast?: { place: string; days: Map<string, DailyForecast> } | null;
  // The user's own events only
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (event: CalendarEvent, scope: EditScope) => void;
}

export function EventDetailsDialog({ event, open, onOpenChange, forecast, onEdit, onDelete }: EventDetailsDialogProps) {
  const format = useFormat();
  const t = useTranslations("calendar");
  const tCommon = useTranslations("common");
  const describeRule = useDescribeRule();
  // Apple Maps on Apple devices, Google Maps elsewhere
  const apple = useIsMac();
  const duration = useEventDuration();
  // Deleting one occurrence of a series asks which to delete first
  const [askScope, setAskScope] = useState(false);
  const source = event?.source;
  // Journeys: the forecast at the destination, loaded when one is opened
  const journeyId = open ? source?.journeyId : undefined;
  const journeyWeather = useJourneyWeather(journeyId ?? "", !!journeyId)[journeyId ?? ""]?.arrival;

  if (!event) return <Dialog open={false} onOpenChange={onOpenChange} />;

  const own = !source;
  const rule = event.rrule ? parseRRule(event.rrule) : null;
  const link = eventLink(event);
  // Places, phones and emails in the location and notes; a location that
  // isn't a link counts as a place
  const location = source?.location && !/^https?:\/\//i.test(source.location) ? source.location : null;
  const contacts = contactsIn([source?.location, event.notes].filter(Boolean).join("\n"));
  const places = [...new Set([location, ...contacts.addresses].filter((p): p is string => !!p))];
  const lasts = duration(event);
  const day = eventDays(event).first;
  // Journeys: at the destination; other events: at the user's own place
  const weather: PlaceWeather | undefined =
    journeyWeather ??
    (() => {
      const found = journeyId ? undefined : forecast?.days.get(day);
      return found && forecast ? { ...found, place: forecast.place } : undefined;
    })();

  const close = (isOpen: boolean) => {
    if (!isOpen) setAskScope(false);
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="break-words">{event.title}</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", source ? SUBSCRIPTION_COLORS[source.color].dot : "bg-leaf")} />
            {own
              ? t("details.fromYours")
              : source!.journeyId
                ? t("details.fromTravel")
                : t("details.fromCalendar", { name: source!.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-3 text-sm">
          <p className="flex items-start gap-2">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span>
              {format.dayWithWeekday(event.allDay ? event.startDate! : event.startsAt!)} ·{" "}
              {eventWhen(event, format, t("allDay"))}
              {lasts && <span className="text-muted-foreground"> · {lasts}</span>}
            </span>
          </p>
          {rule && (
            <p className="flex items-start gap-2">
              <Repeat className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>{describeRule(rule)}</span>
            </p>
          )}
          {places.map((place) => (
            <p key={place} className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 wrap-anywhere">{place}</span>
              <a
                href={mapsUrl(place, apple)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("details.mapLabel", { address: place })}
                className="flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-leaf hover:bg-muted"
              >
                <ExternalLink className="size-3" /> {t("details.openMap")}
              </a>
            </p>
          ))}
          {contacts.phones.map((phone) => (
            <p key={phone.href} className="flex items-center gap-2">
              <Phone className="size-4 shrink-0 text-muted-foreground" />
              <a href={phone.href} className="text-leaf underline-offset-2 hover:underline">
                {phone.text}
              </a>
            </p>
          ))}
          {contacts.emails.map((email) => (
            <p key={email.href} className="flex items-center gap-2">
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              <a href={email.href} className="min-w-0 wrap-anywhere text-leaf underline-offset-2 hover:underline">
                {email.text}
              </a>
            </p>
          ))}
          {link && (
            <div className="pl-6">
              <EventLinkButton link={link} title={event.title} withLabel />
            </div>
          )}
          {weather && <WeatherLine weather={weather} />}
          {event.notes && (
            <p className="max-h-48 overflow-y-auto whitespace-pre-wrap wrap-anywhere rounded-md bg-muted/50 p-3 text-muted-foreground">
              {/* Links, emails and phones in the notes can be opened */}
              {linkify(event.notes).map((segment, i) =>
                segment.href ? (
                  <a
                    key={i}
                    href={segment.href}
                    {...(segment.href.startsWith("http") && { target: "_blank", rel: "noopener noreferrer" })}
                    className="text-leaf underline underline-offset-2"
                  >
                    {segment.text}
                  </a>
                ) : (
                  segment.text
                )
              )}
            </p>
          )}
          {source && !source.journeyId && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Rss className="size-3.5" />
              {t("details.sourceNote")}
            </p>
          )}
        </div>

        {askScope ? (
          <div role="group" aria-label={t("form.applyTo")} className="space-y-3 rounded-md border bg-muted/40 p-3">
            <p className="text-sm">{t("form.scopeQuestion", { action: "delete" })}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setAskScope(false)}>
                {tCommon("back")}
              </Button>
              <Button variant="outline" onClick={() => onDelete?.(event, "one")} autoFocus>
                {t("form.thisEvent")}
              </Button>
              <Button variant="destructive" onClick={() => onDelete?.(event, "all")}>
                {t("form.allEvents")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            {own && onDelete && (
              <Button
                variant="outline"
                className="mr-auto"
                onClick={() => (event.occurrenceDate ? setAskScope(true) : onDelete(event, "all"))}
              >
                <Trash2 className="mr-1 size-4" /> {tCommon("delete")}
              </Button>
            )}
            {source?.journeyId && (
              <Button variant="outline" asChild>
                <Link href={`/travel?journey=${source.journeyId}`}>
                  <Plane className="mr-1 size-4" /> {t("details.openInTravel")}
                </Link>
              </Button>
            )}
            {own && onEdit ? (
              <Button onClick={() => onEdit(event)}>
                <Pencil className="mr-1 size-4" /> {tCommon("edit")}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => close(false)}>
                {tCommon("close")}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// "☁ 18°/11° Cloudy in Paris · 40% rain"
function WeatherLine({ weather }: { weather: PlaceWeather }) {
  const t = useTranslations("travel");
  const weatherLabel = useWeatherLabel();
  return (
    <p className="flex items-center gap-2">
      <WeatherIcon code={weather.code} className="size-4 shrink-0 text-leaf" />
      <span>
        <span className="font-medium">
          {weather.high}°/{weather.low}°
        </span>{" "}
        <span className="text-muted-foreground">
          {t("weather", { conditions: weatherLabel(weather.code), place: weather.place })}
          {weather.precipitation !== null && weather.precipitation >= 30 && t("rainShort", { percent: weather.precipitation })}
        </span>
      </span>
    </p>
  );
}
