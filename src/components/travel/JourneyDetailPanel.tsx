// src/components/travel/JourneyDetailPanel.tsx
// Right-hand panel of Travel (wide screens) for the selected journey: the
// route, local times at each end, duration, the destination's forecast and
// the other details. Edit swaps the view for the form in place.

"use client";

import { useTranslations } from "next-intl";
import { useWeatherLabel } from "@/components/weather/useWeatherLabel";
import { useReminderLabel } from "@/components/travel/useReminderLabel";
import { useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/components/SettingsProvider";
import { JourneyForm } from "@/components/travel/JourneyForm";
import { JourneyWeatherBadge } from "@/components/travel/JourneyWeatherBadge";
import { journeyIcon } from "@/components/travel/journeyIcon";
import type { Formatter } from "@/lib/format";
import { toDateKey } from "@/lib/tasks";
import {
  journeyDuration,
  journeyLabel,
  journeyReminderAt,
  journeyTimes,
  type Journey,
  type JourneyInput,
  type JourneyWeather,
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
  const weatherLabel = useWeatherLabel();
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

  const facts: [string, string | null | undefined][] = [
    [isFlight ? t("field.airline") : t("field.company"), j.carrierName ? `${j.carrierName} (${j.carrier})` : j.carrier],
    [isFlight ? t("field.flight") : t("field.train"), j.number ? journeyLabel(j) : null],
    [t("field.stopover"), j.stopover],
    [isFlight ? t("field.aircraft") : t("field.trainType"), j.vehicle],
    [t("field.registration"), j.aircraftReg],
    [t("field.seat"), j.seat],
    [t("field.gate"), j.gate],
    [t("field.coach"), j.coach],
    [t("field.booking"), j.bookingRef],
    [t("field.price"), j.price ? `${j.price}${j.currency ? ` ${j.currency}` : ""}` : null],
    [t("field.reminder"), reminder],
  ];

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

      {/* Route: codes (or stations) with each end's local time */}
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
        <div className="flex flex-col items-center pt-2 text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="h-px w-6 bg-border sm:w-10" />
            <Icon className="size-4 text-leaf" />
            <span className="h-px w-6 bg-border sm:w-10" />
          </div>
          {duration && <span className="mt-1 text-xs">{duration}</span>}
          {j.distanceKm && <span className="text-xs">{j.distanceKm.toLocaleString()} km</span>}
        </div>
        <End
          place={j.destination}
          name={j.destinationName ?? j.destinationCity}
          date={j.arrivalDate ?? (j.arrivalTime ? j.departureDate : null)}
          time={j.arrivalTime}
          yours={yourTime(j.arrivalTime ? times?.end : undefined, j.arrivalTz)}
          big={isFlight}
          format={format}
          alignEnd
        />
      </div>

      {weather && (
        <p className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
          <JourneyWeatherBadge weather={weather} className="text-sm" />
          <span className="text-muted-foreground">
            {t("weatherOnArrival", { conditions: weatherLabel(weather.code), place: weather.place })}
            {weather.precipitation !== null &&
              weather.precipitation >= 30 &&
              t("rainShort", { percent: weather.precipitation })}
          </span>
        </p>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {facts
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </div>
          ))}
      </dl>

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

function End({
  place,
  name,
  date,
  time,
  yours,
  big,
  format,
  alignEnd = false,
}: {
  place: string;
  name?: string | null;
  date: string | null;
  time: string | null;
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
      {time && <p className="mt-2 text-lg font-medium">{formatClock(format, time)}</p>}
      {date && <p className="text-xs text-muted-foreground">{format.dayWithWeekday(date)}</p>}
      {yours && <p className="text-xs text-muted-foreground">{t("yourTime", { time: yours })}</p>}
    </div>
  );
}
