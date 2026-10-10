// src/components/travel/TravelOverviewPanel.tsx
// Right-hand panel of Travel (wide screens) when no journey is selected: the
// next trip and this year's numbers.

"use client";

import { Plane, TrainFront } from "lucide-react";
import { useFormat } from "@/components/SettingsProvider";
import { formatClock } from "@/components/travel/JourneyDetailPanel";
import { JourneyWeatherBadge } from "@/components/travel/JourneyWeatherBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { dayDiff } from "@/lib/calendar";
import { journeyLabel, type Journey, type JourneyWeather } from "@/lib/travel";

interface TravelOverviewPanelProps {
  journeys: Journey[];
  // Soonest first
  upcoming: Journey[];
  weather: Record<string, JourneyWeather>;
  today: string;
  onSelect: (journey: Journey) => void;
  // Journeys still on their way: placeholders instead of "Nothing planned" and zeros
  loading?: boolean;
}

const placeName = (j: Journey) => j.destinationName ?? j.destinationCity ?? j.destination;

export function TravelOverviewPanel({
  journeys,
  upcoming,
  weather,
  today,
  onSelect,
  loading,
}: TravelOverviewPanelProps) {
  const format = useFormat();
  const next = upcoming[0];
  const year = today.slice(0, 4);
  const thisYear = journeys.filter((j) => j.departureDate.startsWith(year));
  const flights = thisYear.filter((j) => j.kind === "flight");
  const places = new Set(thisYear.map((j) => placeName(j).toLowerCase()));
  const km = flights.reduce((sum, j) => sum + (j.distanceKm ?? 0), 0);

  const daysAway = next ? dayDiff(today, next.departureDate) : 0;
  const when = daysAway === 0 ? "Today" : daysAway === 1 ? "Tomorrow" : `In ${daysAway} days`;

  return (
    <div className="flex h-full flex-col gap-6">
      <section aria-label="Next trip">
        <h3 className="mb-3 text-base font-semibold text-muted-foreground">Next trip</h3>
        {loading ? (
          // The shape of the next-trip card
          <div role="status" aria-label="Loading trips" className="appear-late space-y-3 rounded-lg border bg-background p-4">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3.5 w-1/3" />
          </div>
        ) : next ? (
          <button
            type="button"
            onClick={() => onSelect(next)}
            className="w-full rounded-lg border bg-background p-4 text-left transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-leaf">{when}</span>
              {weather[next.id] && <JourneyWeatherBadge weather={weather[next.id]} />}
            </div>
            <p className="mt-2 flex items-center gap-2 text-xl font-semibold">
              {next.kind === "flight" ? <Plane className="size-5 text-leaf" /> : <TrainFront className="size-5 text-leaf" />}
              <span className="truncate">
                {next.origin} → {next.destination}
              </span>
            </p>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {[next.originName ?? next.originCity, next.destinationName ?? next.destinationCity].every(Boolean) &&
                `${next.originName ?? next.originCity} → ${next.destinationName ?? next.destinationCity} · `}
              {journeyLabel(next)}
            </p>
            <p className="mt-1 text-sm">
              {format.dayWithWeekday(next.departureDate)}
              {next.departureTime && `, ${formatClock(format, next.departureTime)}`}
            </p>
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing planned. Use New Journey to add one, or to paste a booking for the assistant to read.
          </p>
        )}
        {!loading && upcoming.length > 1 && (
          <p className="mt-2 text-sm text-muted-foreground">
            {upcoming.length - 1} more coming up
          </p>
        )}
      </section>

      <section aria-label={`In ${year}`} className="mt-auto">
        <h3 className="mb-3 text-base font-semibold text-muted-foreground">In {year}</h3>
        <div className="grid grid-cols-2 gap-3">
          <Stat value={thisYear.length} label={thisYear.length === 1 ? "journey" : "journeys"} loading={loading} />
          <Stat value={places.size} label={places.size === 1 ? "destination" : "destinations"} loading={loading} />
          <Stat value={flights.length} label={flights.length === 1 ? "flight" : "flights"} loading={loading} />
          <Stat value={thisYear.length - flights.length} label="by train" loading={loading} />
          {!loading && km > 0 && (
            <div className="col-span-2">
              <Stat value={km.toLocaleString()} label="km flown" />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label, loading }: { value: number | string; label: string; loading?: boolean }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      {loading ? (
        <Skeleton className="appear-late my-1.5 h-6 w-8" />
      ) : (
        <p className="text-2xl font-semibold">{value}</p>
      )}
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
