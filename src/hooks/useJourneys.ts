// src/hooks/useJourneys.ts

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { request } from "@/lib/api";
import { onDataChanged } from "@/lib/dataChanged";
import { eventDays } from "@/lib/calendar";
import {
  journeyToEvent,
  type Journey,
  type JourneyEventText,
  type JourneyInput,
  type JourneyWeather,
} from "@/lib/travel";

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

  // e.g. after the assistant added one
  useEffect(() => onDataChanged("journeys", reload), [reload]);

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

// How a journey shown as an event is labelled, in the interface language
export function useJourneyEventText(): JourneyEventText {
  const t = useTranslations("travel");
  return useMemo(
    () => ({ source: t("title"), detail: (field, value) => t(`event.${field}`, { value }) }),
    [t]
  );
}

// Journeys overlapping the days from..to as read-only calendar events
export function journeyEventsBetween(journeys: Journey[], from: string, to: string, text: JourneyEventText) {
  return journeys.map((j) => journeyToEvent(j, text)).filter((e) => {
    const { first, last } = eventDays(e);
    return first <= to && last >= from;
  });
}

// The same, loading the journeys itself (for pages that don't list them)
export function useJourneyEvents(from: string, to: string) {
  const { journeys } = useJourneys();
  const text = useJourneyEventText();
  return useMemo(() => journeyEventsBetween(journeys, from, to, text), [journeys, from, to, text]);
}

// Forecasts at the destinations of journeys arriving in the next two weeks,
// by journey id. `version` changes (e.g. a journey edited) trigger a reload;
// `enabled` false skips loading.
export function useJourneyWeather(version = "", enabled = true) {
  const [weather, setWeather] = useState<Record<string, JourneyWeather>>({});

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    request<Record<string, JourneyWeather>>("/api/journeys/weather")
      .then((next) => !cancelled && setWeather(next))
      // Weather is extra; failing quietly is fine
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [version, enabled]);

  return weather;
}
