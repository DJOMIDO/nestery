// src/lib/subscriptions.ts
// Calendar subscription types and colors, shared by the server and the UI.

// Colors for subscribed calendars, distinct from Nestery's own leaf-green events
export const SUBSCRIPTION_COLORS = {
  sky: { label: "Sky", chip: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200", dot: "bg-sky-500" },
  violet: { label: "Violet", chip: "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200", dot: "bg-violet-500" },
  amber: { label: "Amber", chip: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200", dot: "bg-amber-500" },
  rose: { label: "Rose", chip: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200", dot: "bg-rose-500" },
  teal: { label: "Teal", chip: "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200", dot: "bg-teal-500" },
  slate: { label: "Slate", chip: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200", dot: "bg-slate-500" },
  // Also used for journeys from Travel
  indigo: { label: "Indigo", chip: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200", dot: "bg-indigo-500" },
} as const;

export type SubscriptionColor = keyof typeof SUBSCRIPTION_COLORS;
export const SUBSCRIPTION_COLOR_KEYS = Object.keys(SUBSCRIPTION_COLORS) as [SubscriptionColor, ...SubscriptionColor[]];

// A subscription as returned by /api/subscriptions (without the cached feed)
export interface CalendarSubscription {
  id: string;
  name: string;
  url: string;
  color: SubscriptionColor;
  enabled: boolean;
  lastFetchedAt: string | null;
  lastError: string | null;
  createdAt: string;
}

// Where an event shown on the calendar came from, when it is not the user's own
export interface EventSource {
  // A subscription's id, or "travel" for a journey
  subscriptionId: string;
  name: string;
  color: SubscriptionColor;
  location: string | null;
  // Set on journeys shown from Travel; edited there
  journeyId?: string;
}
