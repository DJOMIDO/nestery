// src/app/(app)/travel/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileUp, Plane, Plus, TrainFront, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/components/SettingsProvider";
import { ImportDialog } from "@/components/travel/ImportDialog";
import { JourneyDialog } from "@/components/travel/JourneyDialog";
import { JourneyWeatherBadge } from "@/components/travel/JourneyWeatherBadge";
import { useJourneys, useJourneyWeather } from "@/hooks/useJourneys";
import type { Formatter } from "@/lib/format";
import { toDateKey } from "@/lib/tasks";
import { journeyLabel, type Journey, type JourneyKind, type JourneyWeather } from "@/lib/travel";
import { cn } from "@/lib/utils";

type Filter = "all" | JourneyKind;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "flight", label: "Flights" },
  { value: "train", label: "Trains" },
];

// "14:30" in the user's 12/24-hour format
const formatClock = (format: Formatter, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return format.time(new Date(2000, 0, 1, h, m));
};

// useSearchParams needs a Suspense boundary on a statically rendered page
export default function TravelPage() {
  return (
    <Suspense>
      <TravelPageContent />
    </Suspense>
  );
}

function TravelPageContent() {
  const { journeys, loading, createJourney, updateJourney, deleteJourney, reload } = useJourneys();
  const [filter, setFilter] = useState<Filter>("all");
  const [dialog, setDialog] = useState<{ kind: JourneyKind; journey: Journey | null } | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // ?journey=<id> (from the calendar or the assistant) opens it once loaded
  const router = useRouter();
  const linked = useSearchParams().get("journey");
  useEffect(() => {
    if (!linked || loading) return;
    const journey = journeys.find((j) => j.id === linked);
    if (journey) setDialog({ kind: journey.kind, journey });
    router.replace("/travel", { scroll: false });
  }, [linked, loading, journeys, router]);

  // Reloaded when a journey's destination or dates change
  const weatherVersion = journeys.map((j) => `${j.id}:${j.destination}:${j.arrivalDate ?? j.departureDate}`).join();
  const weather = useJourneyWeather(weatherVersion, !loading && journeys.length > 0);

  const today = toDateKey(new Date());
  const { upcoming, past } = useMemo(() => {
    const shown = journeys.filter((j) => filter === "all" || j.kind === filter);
    const byStart = (a: Journey, b: Journey) =>
      `${a.departureDate}${a.departureTime ?? ""}`.localeCompare(`${b.departureDate}${b.departureTime ?? ""}`);
    return {
      // Soonest first
      upcoming: shown.filter((j) => j.departureDate >= today).sort(byStart),
      // Most recent first
      past: shown.filter((j) => j.departureDate < today).sort((a, b) => byStart(b, a)),
    };
  }, [journeys, filter, today]);

  const handleDelete = async (journey: Journey) => {
    if (window.confirm(`Delete ${journeyLabel(journey)} on ${journey.departureDate}?`)) await deleteJourney(journey.id);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold">Travel</h1>
          <p className="text-sm text-muted-foreground">Your flights and train journeys.</p>
        </div>
        <Button variant="ghost" onClick={() => setImportOpen(true)}>
          <FileUp className="mr-1 size-4" /> Import
        </Button>
        <Button variant="outline" onClick={() => setDialog({ kind: "train", journey: null })}>
          <TrainFront className="mr-1 size-4" /> Add train
        </Button>
        <Button onClick={() => setDialog({ kind: "flight", journey: null })}>
          <Plus className="mr-1 size-4" /> Add flight
        </Button>
      </div>

      <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Show">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={cn(
              "rounded px-3 py-1 text-sm",
              filter === value ? "bg-leaf-soft text-leaf" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : journeys.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <p>No journeys yet. Add a flight or a train, or import a CSV file from your old travel tracker.</p>
        </div>
      ) : (
        <>
          <JourneySection
            title="Upcoming"
            journeys={upcoming}
            weather={weather}
            empty="Nothing planned."
            onOpen={(j) => setDialog({ kind: j.kind, journey: j })}
            onDelete={handleDelete}
          />
          <JourneySection
            title="Past"
            journeys={past}
            empty="No past journeys."
            onOpen={(j) => setDialog({ kind: j.kind, journey: j })}
            onDelete={handleDelete}
          />
        </>
      )}

      {dialog && (
        <JourneyDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          kind={dialog.kind}
          journey={dialog.journey}
          onSubmit={(input) => (dialog.journey ? updateJourney(dialog.journey.id, input) : createJourney(input))}
        />
      )}
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={reload} />
    </div>
  );
}

function JourneySection({
  title,
  journeys,
  weather = {},
  empty,
  onOpen,
  onDelete,
}: {
  title: string;
  journeys: Journey[];
  // By journey id; only for upcoming journeys
  weather?: Record<string, JourneyWeather>;
  empty: string;
  onOpen: (journey: Journey) => void;
  onDelete: (journey: Journey) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">
        {title} <span className="font-normal">· {journeys.length}</span>
      </h2>
      {journeys.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {journeys.map((j) => (
            <JourneyRow key={j.id} journey={j} weather={weather[j.id]} onOpen={onOpen} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </section>
  );
}

function JourneyRow({
  journey: j,
  weather,
  onOpen,
  onDelete,
}: {
  journey: Journey;
  weather?: JourneyWeather;
  onOpen: (journey: Journey) => void;
  onDelete: (journey: Journey) => void;
}) {
  const format = useFormat();
  const Icon = j.kind === "flight" ? Plane : TrainFront;
  const place = (code: string, name?: string, city?: string | null) => (
    <span title={name ?? city ?? undefined}>
      <span className="font-medium">{code}</span>
      {(name ?? city) && j.kind === "flight" && (
        <span className="hidden text-muted-foreground sm:inline"> {name}</span>
      )}
    </span>
  );
  const times = [j.departureTime, j.arrivalTime].filter(Boolean).map((t) => formatClock(format, t!));

  return (
    <li className="group flex items-center gap-3 px-3 py-2.5">
      <button type="button" onClick={() => onOpen(j)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Icon className="size-4 shrink-0 text-leaf" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            {place(j.origin, j.originName, j.originCity)}
            <span className="mx-1.5 text-muted-foreground">→</span>
            {place(j.destination, j.destinationName, j.destinationCity)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {journeyLabel(j)}
            {j.carrierName && ` · ${j.carrierName}`}
            {j.seat && ` · Seat ${j.seat}`}
          </p>
        </div>
        <div className="shrink-0 text-right text-sm">
          <p>{format.dayWithYear(j.departureDate)}</p>
          {times.length > 0 && <p className="text-xs text-muted-foreground">{times.join(" – ")}</p>}
          {weather && <JourneyWeatherBadge weather={weather} className="justify-end" />}
        </div>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        onClick={() => onDelete(j)}
        title="Delete"
      >
        <Trash2 className="size-4" />
        <span className="sr-only">Delete</span>
      </Button>
    </li>
  );
}
