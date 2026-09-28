// src/hooks/useEvents.ts

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { request } from "@/lib/api";
import type { CalendarEvent } from "@/lib/calendar";

// Shape accepted by POST /api/events and PATCH /api/events/[id]. Timing
// changes send allDay with its matching start/end pair.
export type EventInput = Partial<
  Pick<CalendarEvent, "title" | "notes" | "allDay" | "startsAt" | "endsAt" | "startDate" | "endDate">
>;

// Loads the events overlapping the days from..to (YYYY-MM-DD) and exposes
// create/update/delete helpers that keep the list in sync. Errors are toasts.
export function useEvents(from: string, to: string) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setEvents(await request<CalendarEvent[]>(`/api/events?from=${from}&to=${to}`));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    reload();
  }, [reload]);

  const createEvent = useCallback(async (input: EventInput) => {
    try {
      const event = await request<CalendarEvent>("/api/events", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setEvents((prev) => [...prev, event]);
      return event;
    } catch (err) {
      toast.error((err as Error).message);
      return null;
    }
  }, []);

  const updateEvent = useCallback(async (id: string, input: EventInput) => {
    try {
      const event = await request<CalendarEvent>(`/api/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      setEvents((prev) => prev.map((e) => (e.id === id ? event : e)));
      return event;
    } catch (err) {
      toast.error((err as Error).message);
      return null;
    }
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    try {
      await request<null>(`/api/events/${id}`, { method: "DELETE" });
      setEvents((prev) => prev.filter((e) => e.id !== id));
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    }
  }, []);

  return { events, loading, reload, createEvent, updateEvent, deleteEvent };
}
