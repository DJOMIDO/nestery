// src/hooks/useJourneys.ts

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { request } from "@/lib/api";
import { eventDays } from "@/lib/calendar";
import { journeyToEvent, type Journey, type JourneyInput } from "@/lib/travel";

// Loads the user's journeys and exposes create/update/delete helpers that
// keep the list in sync. Errors are shown as toasts.
export function useJourneys() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setJourneys(await request<Journey[]>("/api/journeys"));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const createJourney = useCallback(async (input: JourneyInput) => {
    try {
      const journey = await request<Journey>("/api/journeys", { method: "POST", body: JSON.stringify(input) });
      setJourneys((prev) => [journey, ...prev]);
      return journey;
    } catch (err) {
      toast.error((err as Error).message);
      return null;
    }
  }, []);

  const updateJourney = useCallback(async (id: string, input: JourneyInput) => {
    try {
      const journey = await request<Journey>(`/api/journeys/${id}`, { method: "PUT", body: JSON.stringify(input) });
      setJourneys((prev) => prev.map((j) => (j.id === id ? journey : j)));
      return journey;
    } catch (err) {
      toast.error((err as Error).message);
      return null;
    }
  }, []);

  const deleteJourney = useCallback(async (id: string) => {
    try {
      await request(`/api/journeys/${id}`, { method: "DELETE" });
      setJourneys((prev) => prev.filter((j) => j.id !== id));
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    }
  }, []);

  return { journeys, loading, reload, createJourney, updateJourney, deleteJourney };
}

// Journeys overlapping the days from..to as read-only calendar events
export function journeyEventsBetween(journeys: Journey[], from: string, to: string) {
  return journeys.map(journeyToEvent).filter((e) => {
    const { first, last } = eventDays(e);
    return first <= to && last >= from;
  });
}

// The same, loading the journeys itself (for pages that don't list them)
export function useJourneyEvents(from: string, to: string) {
  const { journeys } = useJourneys();
  return useMemo(() => journeyEventsBetween(journeys, from, to), [journeys, from, to]);
}
