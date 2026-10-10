// src/components/travel/JourneyDetailPanel.tsx
// Right-hand panel of Travel (wide screens) for the selected journey: the
// route, local times at each end, duration, the destination's forecast and
// the other details. Edit swaps the view for the form in place.

"use client";

import { useState } from "react";
import { Pencil, Plane, TrainFront, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/components/SettingsProvider";
import { JourneyForm } from "@/components/travel/JourneyForm";
import { JourneyWeatherBadge } from "@/components/travel/JourneyWeatherBadge";
import type { Formatter } from "@/lib/format";
import {
  journeyDuration,
  journeyLabel,
  journeyReminderAt,
  journeyTimes,
  reminderLabel,
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
  const [editing, setEditing] = useState(false);
  const isFlight = j.kind === "flight";
  const Icon = isFlight ? Plane : TrainFront;

  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Edit {isFlight ? "flight" : "train journey"}</h2>
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
  const duration = journeyDuration(j);

  const facts: [string, string | null | undefined][] = [
    [isFlight ? "Airline" : "Company", j.carrierName ? `${j.carrierName} (${j.carrier})` : j.carrier],
    [isFlight ? "Flight" : "Train", j.number ? journeyLabel(j) : null],
    ["Stopover", j.stopover],
    [isFlight ? "Aircraft" : "Train type", j.vehicle],
    ["Registration", j.aircraftReg],
    ["Seat", j.seat],
    ["Gate", j.gate],
    ["Coach", j.coach],
    ["Booking", j.bookingRef],
    ["Price", j.price ? `${j.price}${j.currency ? ` ${j.currency}` : ""}` : null],
    ["Reminder", reminderText(j, format)],
  ];

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Icon className="size-4 text-leaf" /> {isFlight ? "Flight" : "Train"}
        </h2>
        <button onClick={onClose} className="rounded p-1.5 hover:bg-muted" aria-label="Close details">
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
            {weather.conditions} in {weather.place} on arrival
            {weather.precipitation !== null && weather.precipitation >= 30 && ` · ${weather.precipitation}% rain`}
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
          <Trash2 className="mr-1 size-4" /> Delete
        </Button>
        <Button onClick={() => setEditing(true)}>
          <Pencil className="mr-1 size-4" /> Edit
        </Button>
      </div>
    </div>
  );
}

// "3 hours before (Oct 18, 2:40 PM)", on the viewer's clock
function reminderText(j: Journey, format: Formatter) {
  if (j.remindBefore === null) return null;
  const at = journeyReminderAt(j);
  return at ? `${reminderLabel(j.remindBefore)} (${format.dayTime(at)})` : `${reminderLabel(j.remindBefore)} (needs a departure time)`;
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
  return (
    <div className={alignEnd ? "min-w-0 text-right" : "min-w-0"}>
      <p className={big ? "text-3xl font-bold tracking-tight" : "break-words text-lg font-semibold"}>{place}</p>
      {name && <p className="truncate text-sm text-muted-foreground">{name}</p>}
      {time && <p className="mt-2 text-lg font-medium">{formatClock(format, time)}</p>}
      {date && <p className="text-xs text-muted-foreground">{format.dayWithWeekday(date)}</p>}
      {yours && <p className="text-xs text-muted-foreground">{yours} your time</p>}
    </div>
  );
}
