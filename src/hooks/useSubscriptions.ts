// src/hooks/useSubscriptions.ts

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { request } from "@/lib/api";
import type { CalendarEvent } from "@/lib/calendar";
import type { CalendarSubscription, SubscriptionColor } from "@/lib/subscriptions";

export interface SubscriptionInput {
  name: string;
  url: string;
  color: SubscriptionColor;
}

// The user's calendar subscriptions with add/update/remove/refresh helpers.
// Errors are toasts; `add` returns the server's message instead, for the form.
export function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<CalendarSubscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request<CalendarSubscription[]>("/api/subscriptions")
      .then(setSubscriptions)
      .catch((err) => toast.error((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const add = useCallback(async (input: SubscriptionInput) => {
    try {
      const created = await request<CalendarSubscription>("/api/subscriptions", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setSubscriptions((prev) => [...prev, created]);
      return { subscription: created };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }, []);

  // Optimistic (toggles and renames should feel instant); rolled back on failure
  const update = useCallback(
    async (id: string, input: Partial<Pick<CalendarSubscription, "name" | "color" | "enabled">>) => {
      let previous: CalendarSubscription | undefined;
      setSubscriptions((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          previous = s;
          return { ...s, ...input };
        })
      );
      try {
        const updated = await request<CalendarSubscription>(`/api/subscriptions/${id}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        });
        setSubscriptions((prev) => prev.map((s) => (s.id === id ? updated : s)));
        return updated;
      } catch (err) {
        if (previous) {
          const original = previous;
          setSubscriptions((prev) => prev.map((s) => (s.id === id ? original : s)));
        }
        toast.error((err as Error).message);
        return null;
      }
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    try {
      await request<null>(`/api/subscriptions/${id}`, { method: "DELETE" });
      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    }
  }, []);

  const refresh = useCallback(async (id: string) => {
    try {
      const updated = await request<CalendarSubscription>(`/api/subscriptions/${id}/refresh`, {
        method: "POST",
      });
      setSubscriptions((prev) => prev.map((s) => (s.id === id ? updated : s)));
      return updated;
    } catch (err) {
      toast.error((err as Error).message);
      return null;
    }
  }, []);

  return { subscriptions, loading, add, update, remove, refresh };
}

// Read-only events from enabled subscriptions overlapping from..to. `version`
// changes (e.g. a subscription toggled) trigger a reload.
export function useSubscriptionEvents(from: string, to: string, version = "") {
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    request<CalendarEvent[]>(
      `/api/subscriptions/events?from=${from}&to=${to}&tz=${encodeURIComponent(tz)}`
    )
      .then((list) => !cancelled && setEvents(list))
      // Subscribed calendars are extra; failing to load them should not be noisy
      .catch(() => !cancelled && setEvents([]));
    return () => {
      cancelled = true;
    };
  }, [from, to, version]);

  return events;
}
