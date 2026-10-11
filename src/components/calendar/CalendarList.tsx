// src/components/calendar/CalendarList.tsx
"use client";

import Link from "next/link";
import { Settings } from "lucide-react";
import { SUBSCRIPTION_COLORS, type CalendarSubscription } from "@/lib/subscriptions";
import { cn } from "@/lib/utils";

interface CalendarListProps {
  subscriptions: CalendarSubscription[];
  onToggle: (subscription: CalendarSubscription) => void;
}

// The subscribed calendars, below the day's agenda: each row shows or hides
// its calendar, and its dot is the color its events have on the grid. It
// grows downward, so many calendars never push the grid down.
export function CalendarList({ subscriptions, onToggle }: CalendarListProps) {
  return (
    <section aria-label="Calendars" className="shrink-0 rounded-lg border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-semibold">Calendars</h2>
        <Link
          href="/settings?section=calendar&focus=calendars"
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Manage calendars"
          title="Manage calendars"
        >
          <Settings className="size-4" />
        </Link>
      </div>
      <ul className="-mx-2">
        {subscriptions.map((sub) => (
          <li key={sub.id}>
            <button
              type="button"
              onClick={() => onToggle(sub)}
              aria-pressed={sub.enabled}
              title={sub.lastError ? `Last refresh failed: ${sub.lastError}` : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                !sub.enabled && "text-muted-foreground"
              )}
            >
              {/* Filled when shown, an outline when hidden */}
              <span
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  sub.enabled ? SUBSCRIPTION_COLORS[sub.color].dot : "border border-current"
                )}
              />
              <span className="min-w-0 flex-1 truncate">{sub.name}</span>
              {sub.lastError && (
                <span className="text-xs font-semibold text-destructive" aria-label="Last refresh failed">
                  !
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
