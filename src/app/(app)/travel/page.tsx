// src/app/(app)/travel/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, ClipboardPaste, FileUp, Plane, Plus, TrainFront } from "lucide-react";
import { useAssistant } from "@/components/assistant/AssistantProvider";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/components/SettingsProvider";
import { ImportDialog } from "@/components/travel/ImportDialog";
import { JourneyDetailPanel, formatClock } from "@/components/travel/JourneyDetailPanel";
import { JourneyDialog } from "@/components/travel/JourneyDialog";
import { JourneyWeatherBadge } from "@/components/travel/JourneyWeatherBadge";
import { TravelOverviewPanel } from "@/components/travel/TravelOverviewPanel";
import { useJourneys, useJourneyWeather } from "@/hooks/useJourneys";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { toDateKey } from "@/lib/tasks";
import { journeyLabel, type Journey, type JourneyKind, type JourneyWeather } from "@/lib/travel";
import { cn } from "@/lib/utils";

type Filter = "all" | JourneyKind;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "flight", label: "Flights" },
  { value: "train", label: "Trains" },
];

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
  // Details in the side panel on large screens (Tailwind `lg`); a dialog otherwise
  const isWide = useMediaQuery("(min-width: 1024px)");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ kind: JourneyKind; journey: Journey | null } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [showPast, setShowPast] = useState<boolean | null>(null);
  const assistant = useAssistant();

  const open = (journey: Journey) =>
    isWide ? setSelectedId(journey.id) : setDialog({ kind: journey.kind, journey });

  // ?journey=<id> (from the calendar or the assistant) opens it once loaded
  const router = useRouter();
  const linked = useSearchParams().get("journey");
  useEffect(() => {
    if (!linked || loading) return;
    const journey = journeys.find((j) => j.id === linked);
    if (journey) open(journey);
    router.replace("/travel", { scroll: false });
    // `open` only depends on isWide, listed below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linked, loading, journeys, router, isWide]);

  // Reloaded when a journey's destination or dates change
  const weatherVersion = journeys.map((j) => `${j.id}:${j.destination}:${j.arrivalDate ?? j.departureDate}`).join();
  const weather = useJourneyWeather(weatherVersion, !loading && journeys.length > 0);

  const today = toDateKey(new Date());
  const { upcoming, past, allUpcoming } = useMemo(() => {
    const byStart = (a: Journey, b: Journey) =>
      `${a.departureDate}${a.departureTime ?? ""}`.localeCompare(`${b.departureDate}${b.departureTime ?? ""}`);
    const shown = journeys.filter((j) => filter === "all" || j.kind === filter);
    return {
      // Soonest first
      upcoming: shown.filter((j) => j.departureDate >= today).sort(byStart),
      // Most recent first
      past: shown.filter((j) => j.departureDate < today).sort((a, b) => byStart(b, a)),
      // For the overview, whatever the filter
      allUpcoming: journeys.filter((j) => j.departureDate >= today).sort(byStart),
    };
  }, [journeys, filter, today]);

  // Past is folded while there is something coming up, unless opened
  const pastOpen = showPast ?? upcoming.length === 0;
  const selected = isWide ? (journeys.find((j) => j.id === selectedId) ?? null) : null;

  const handleDelete = async (journey: Journey) => {
    if (!window.confirm(`Delete ${journeyLabel(journey)} on ${journey.departureDate}?`)) return;
    if (await deleteJourney(journey.id)) {
      if (selectedId === journey.id) setSelectedId(null);
      setDialog(null);
    }
  };

  // The buttons wrap below the title as one group, never one by one
  const header = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
      <div className="mr-auto">
        <h1 className="text-2xl font-bold">Travel</h1>
        <p className="text-sm text-muted-foreground">Your flights and train journeys.</p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setImportOpen(true)}
          title="Import from CSV"
          aria-label="Import from CSV"
        >
          <FileUp className="size-4" />
        </Button>
        <Button
          variant="ghost"
          onClick={() => assistant.openWithDraft("Add the journeys from this booking to Travel:\n\n")}
          title="Paste a booking confirmation or e-ticket; the assistant proposes the journeys"
          aria-label="Paste booking"
        >
          <ClipboardPaste className="size-4 sm:mr-1" />
          {/* Icon only on phones, so all the buttons fit on one line */}
          <span className="hidden sm:inline">Paste booking</span>
        </Button>
        <Button variant="outline" onClick={() => setDialog({ kind: "train", journey: null })}>
          <TrainFront className="mr-1 size-4" /> Train
        </Button>
        <Button onClick={() => setDialog({ kind: "flight", journey: null })}>
          <Plus className="mr-1 size-4" /> Flight
        </Button>
      </div>
    </div>
  );

  return (
    // On large screens both columns fill the viewport; the list scrolls on its own
    <div className="grid grid-cols-1 gap-6 lg:h-full lg:grid-cols-2 lg:grid-rows-1">
      {/* Left: the list. -ml-1 pl-1 keeps focus rings from being clipped by the scroll area */}
      <div className="min-w-0 space-y-6 lg:-ml-1 lg:min-h-0 lg:overflow-y-auto lg:pl-1 lg:pr-2">
        {header}

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
          <p className="py-12 text-center text-sm text-muted-foreground">
            No journeys yet. Add a flight or a train, paste a booking confirmation for the assistant to read, or import
            a CSV file.
          </p>
        ) : (
          <>
            <section aria-label="Upcoming">
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Upcoming ({upcoming.length})</h2>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing planned.</p>
              ) : (
                <JourneyList journeys={upcoming} weather={weather} selectedId={selected?.id} onOpen={open} />
              )}
            </section>

            {past.length > 0 && (
              <section aria-label="Past">
                <button
                  onClick={() => setShowPast(!pastOpen)}
                  className="mb-2 flex items-center gap-1 text-sm font-semibold text-muted-foreground"
                  aria-expanded={pastOpen}
                >
                  {pastOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  Past ({past.length})
                </button>
                {pastOpen && <JourneyList journeys={past} selectedId={selected?.id} onOpen={open} />}
              </section>
            )}
          </>
        )}
      </div>

      {/* Right: the selected journey, or an overview (wide screens only) */}
      <aside aria-label={selected ? "Journey details" : "Travel overview"} className="hidden min-h-0 min-w-0 lg:block">
        <div className="h-full overflow-y-auto rounded-lg border bg-card p-5">
          {selected ? (
            <JourneyDetailPanel
              key={selected.id}
              journey={selected}
              weather={weather[selected.id]}
              onSave={(input) => updateJourney(selected.id, input)}
              onDelete={() => handleDelete(selected)}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <TravelOverviewPanel
              journeys={journeys}
              upcoming={allUpcoming}
              weather={weather}
              today={today}
              onSelect={(j) => setSelectedId(j.id)}
            />
          )}
        </div>
      </aside>

      {dialog && (
        <JourneyDialog
          open
          onOpenChange={(isOpen) => !isOpen && setDialog(null)}
          kind={dialog.kind}
          journey={dialog.journey}
          onDelete={dialog.journey ? () => handleDelete(dialog.journey!) : undefined}
          onSubmit={async (input) => {
            if (dialog.journey) return updateJourney(dialog.journey.id, input);
            const created = await createJourney(input);
            // Show what was just added
            if (created && isWide) setSelectedId(created.id);
            return created;
          }}
        />
      )}
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={reload} />
    </div>
  );
}

function JourneyList({
  journeys,
  weather = {},
  selectedId,
  onOpen,
}: {
  journeys: Journey[];
  // By journey id; only for upcoming journeys
  weather?: Record<string, JourneyWeather>;
  selectedId?: string;
  onOpen: (journey: Journey) => void;
}) {
  return (
    <ul className="space-y-1">
      {journeys.map((j) => (
        <JourneyRow key={j.id} journey={j} weather={weather[j.id]} selected={j.id === selectedId} onOpen={onOpen} />
      ))}
    </ul>
  );
}

function JourneyRow({
  journey: j,
  weather,
  selected,
  onOpen,
}: {
  journey: Journey;
  weather?: JourneyWeather;
  selected: boolean;
  onOpen: (journey: Journey) => void;
}) {
  const format = useFormat();
  const Icon = j.kind === "flight" ? Plane : TrainFront;
  const names = [j.originName ?? j.originCity, j.destinationName ?? j.destinationCity];

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(j)}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-muted/60",
          selected && "bg-primary/10 hover:bg-primary/10 dark:bg-primary/20"
        )}
      >
        <Icon className="mt-0.5 size-4 shrink-0 text-leaf" />
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium" title={names.every(Boolean) ? names.join(" → ") : undefined}>
              {j.origin} → {j.destination}
            </span>
            <span className="shrink-0">{format.dayWithWeekday(j.departureDate)}</span>
          </p>
          <p className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="truncate">
              {journeyLabel(j)}
              {j.carrierName && ` · ${j.carrierName}`}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {weather && <JourneyWeatherBadge weather={weather} />}
              {j.departureTime && formatClock(format, j.departureTime)}
            </span>
          </p>
        </div>
      </button>
    </li>
  );
}
