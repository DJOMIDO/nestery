// src/components/travel/JourneyDetailPanel.tsx
// Right-hand panel of Travel (wide screens) for the selected journey, laid
// out like a ticket: the carrier's logo and number, the route with local
// times at each end, duration and time difference, the forecast at both
// ends (coming journeys) and the other details in a grid. Edit swaps the
// view for the form in place.

"use client";

import { useTranslations } from "next-intl";
import { useWeatherLabel } from "@/components/weather/useWeatherLabel";
import { useReminderLabel } from "@/components/travel/useReminderLabel";
import { useState } from "react";
import { Clock, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/components/SettingsProvider";
import { JourneyForm } from "@/components/travel/JourneyForm";
import { CarrierLogo } from "@/components/travel/CarrierLogo";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { journeyIcon } from "@/components/travel/journeyIcon";
import type { Formatter } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toDateKey } from "@/lib/tasks";
import {
  journeyDayShift,
  journeyDuration,
  journeyLabel,
  journeyReminderAt,
  journeyTimeDifference,
  journeyTimes,
  type Journey,
  type JourneyInput,
  type JourneyWeather,
  type PlaceWeather,
} from "@/lib/travel";

// "14:30" in the user's 12/24-hour format
export const formatClock = (format: Formatter, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return format.time(new Date(2000, 0, 1, h, m));
};

const viewerZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

interface JourneyDetailPanelProps {
  journey: Journey;
  weather?: JourneyWeather;
  onSave: (input: JourneyInput) => Promise<unknown>;
  onDelete: () => void;
  onClose: () => void;
}

export function JourneyDetailPanel({ journey: j, weather, onSave, onDelete, onClose }: JourneyDetailPanelProps) {
  const format = useFormat();
  const t = useTranslations("travel");
  const tCommon = useTranslations("common");
  const reminderLabel = useReminderLabel();
  const [editing, setEditing] = useState(false);
  const isFlight = j.kind === "flight";
  const Icon = journeyIcon(j.kind);

  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{isFlight ? t("editFlight") : t("editTrain")}</h2>
        <JourneyForm
          key={`${j.id}-${j.updatedAt}`}
          kind={j.kind}
          journey={j}
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => {
            const saved = await onSave(input);
            if (saved) setEditing(false);
            return saved;
          }}
        />
      </div>
    );
  }

  // The departure on the viewer's clock, when the journey's zone differs
  const times = journeyTimes(j);
  const zone = viewerZone();
  const yourTime = (moment: Date | undefined, endZone: string | null) =>
    moment && endZone && endZone !== zone ? format.time(moment) : null;
  const span = journeyDuration(j);
  const duration = span && t("duration", span);

  // "3 hours before (Oct 18, 2:40 PM)", on the viewer's clock. Left out once
  // the journey has left: a reminder for it no longer means anything.
  const departed = times ? times.start.getTime() <= Date.now() : j.departureDate < toDateKey(new Date());
  const reminderAt = journeyReminderAt(j);
  const reminder =
    j.remindBefore === null || departed
      ? null
      : reminderAt
        ? t("remind.at", { before: reminderLabel(j.remindBefore), time: format.dayTime(reminderAt) })
        : t("remind.needsTime", { before: reminderLabel(j.remindBefore) });

  // Upcoming journeys only: a past one's weather no longer matters
  const ended = times ? times.end.getTime() < Date.now() : (j.arrivalDate ?? j.departureDate) < toDateKey(new Date());
  const difference = journeyTimeDifference(j);
  const dayShift = j.arrivalTime ? journeyDayShift(j) : 0;
  const summary = [
    duration,
    j.distanceKm && `${j.distanceKm.toLocaleString()} km`,
    difference ? t("timeDifference", timeDifferenceParts(difference)) : null,
  ].filter(Boolean);

  // The airline (or company) and number are in the header above
  const facts: { label: string; value: string | null | undefined; wide?: boolean }[] = [
    { label: t("field.seat"), value: j.seat },
    { label: t("field.gate"), value: j.gate },
    { label: t("field.coach"), value: j.coach },
    { label: isFlight ? t("field.aircraft") : t("field.trainType"), value: j.vehicle },
    { label: t("field.registration"), value: j.aircraftReg },
    { label: t("field.stopover"), value: j.stopover },
    { label: t("field.booking"), value: j.bookingRef },
    { label: t("field.price"), value: j.price ? `${j.price}${j.currency ? ` ${j.currency}` : ""}` : null },
    { label: t("field.reminder"), value: reminder, wide: true },
  ].filter((f) => f.value);

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Icon className="size-4 text-leaf" /> {isFlight ? t("flight") : t("train")}
        </h2>
        <button onClick={onClose} className="rounded p-1.5 hover:bg-muted" aria-label={tCommon("close")}>
          <X className="size-4" />
        </button>
      </div>

      {/* Ticket header: who operates it and the number */}
      <div className="flex items-center gap-3">
        <CarrierLogo kind={j.kind} carrier={j.carrier} name={j.carrierName} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{j.carrierName ?? j.carrier}</p>
          <p className="truncate text-sm text-muted-foreground">
            {[j.number ? journeyLabel(j) : null, j.vehicle].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {/* Route: codes (or stations) with each end's local time */}
      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
          <End
            place={j.origin}
            name={j.originName ?? j.originCity}
            date={j.departureDate}
            time={j.departureTime}
            yours={yourTime(times?.start, j.departureTz)}
            big={isFlight}
            format={format}
          />
          <div className="flex items-center gap-1 pt-3 text-muted-foreground">
            <span className="h-px w-5 bg-border sm:w-8" />
            <Icon className="size-4 text-leaf" />
            <span className="h-px w-5 bg-border sm:w-8" />
          </div>
          <End
            place={j.destination}
            name={j.destinationName ?? j.destinationCity}
            date={j.arrivalDate ?? (j.arrivalTime ? j.departureDate : null)}
            time={j.arrivalTime}
            dayShift={dayShift}
            yours={yourTime(j.arrivalTime ? times?.end : undefined, j.arrivalTz)}
            big={isFlight}
            format={format}
            alignEnd
          />
        </div>
        {summary.length > 0 && (
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" /> {summary.join(" · ")}
          </p>
        )}
      </div>

      {weather && !ended && (
        <div className="grid grid-cols-2 gap-2">
          {weather.departure ? (
            <WeatherTile label={t("weatherDeparture")} weather={weather.departure} />
          ) : (
            <span />
          )}
          <WeatherTile label={t("weatherArrival")} weather={weather} />
        </div>
      )}

      {facts.length > 0 && (
        <>
          {/* A ticket's tear-off line */}
          <div className="border-t border-dashed" />
          <dl className="grid grid-cols-2 gap-2 xl:grid-cols-3">
            {facts.map(({ label, value, wide }) => (
              <div key={label} className={cn("min-w-0 rounded-md bg-muted/50 px-3 py-2", wide && "col-span-full")}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="break-words text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {j.notes && (
        <p className="whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
          {j.notes}
        </p>
      )}

      <div className="mt-auto flex justify-end gap-2">
        <Button variant="outline" onClick={onDelete}>
          <Trash2 className="mr-1 size-4" /> {tCommon("delete")}
        </Button>
        <Button onClick={() => setEditing(true)}>
          <Pencil className="mr-1 size-4" /> {tCommon("edit")}
        </Button>
      </div>
    </div>
  );
}

// "+6 h", "-5 h 30 min": the parts for travel.timeDifference
const timeDifferenceParts = (minutes: number) => ({
  sign: minutes > 0 ? "+" : "-",
  hours: Math.floor(Math.abs(minutes) / 60),
  minutes: Math.abs(minutes) % 60,
});

// The forecast at one end, on the day the journey is there
function WeatherTile({ label, weather }: { label: string; weather: PlaceWeather }) {
  const t = useTranslations("travel");
  const weatherLabel = useWeatherLabel();
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-md bg-muted/50 px-3 py-2">
      <WeatherIcon code={weather.code} className="size-6 shrink-0 text-leaf" />
      <div className="min-w-0 text-sm">
        <p className="truncate text-xs text-muted-foreground">
          {label} · {weather.place}
        </p>
        <p className="truncate">
          <span className="font-medium">
            {weather.high}°/{weather.low}°
          </span>{" "}
          <span className="text-muted-foreground">
            {weatherLabel(weather.code)}
            {weather.precipitation !== null &&
              weather.precipitation >= 30 &&
              t("rainShort", { percent: weather.precipitation })}
          </span>
        </p>
      </div>
    </div>
  );
}

function End({
  place,
  name,
  date,
  time,
  dayShift = 0,
  yours,
  big,
  format,
  alignEnd = false,
}: {
  place: string;
  name?: string | null;
  date: string | null;
  time: string | null;
  // Days after (or before) the departure's date, shown as "+1"
  dayShift?: number;
  // The same moment on the viewer's clock, when the zones differ
  yours: string | null;
  // Airport codes are short: show them large; station names stay normal
  big: boolean;
  format: Formatter;
  alignEnd?: boolean;
}) {
  const t = useTranslations("travel");
  return (
    <div className={alignEnd ? "min-w-0 text-right" : "min-w-0"}>
      <p className={big ? "text-3xl font-bold tracking-tight" : "break-words text-lg font-semibold"}>{place}</p>
      {name && <p className="truncate text-sm text-muted-foreground">{name}</p>}
      {time && (
        <p className="mt-2 text-xl font-semibold tabular-nums">
          {formatClock(format, time)}
          {dayShift !== 0 && (
            <sup
              className="ml-0.5 text-xs font-semibold text-leaf"
              title={t("dayShift", { later: String(dayShift > 0), days: Math.abs(dayShift) })}
            >
              {dayShift > 0 ? `+${dayShift}` : dayShift}
            </sup>
          )}
        </p>
      )}
      {date && <p className="text-xs text-muted-foreground">{format.dayWithWeekday(date)}</p>}
      {yours && <p className="text-xs text-muted-foreground">{t("yourTime", { time: yours })}</p>}
    </div>
  );
}
