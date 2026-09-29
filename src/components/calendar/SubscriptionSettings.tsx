// src/components/calendar/SubscriptionSettings.tsx
"use client";

import { useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { formatRelative } from "@/lib/tasks";
import { useFormat } from "@/components/SettingsProvider";
import {
  SUBSCRIPTION_COLOR_KEYS,
  SUBSCRIPTION_COLORS,
  type CalendarSubscription,
  type SubscriptionColor,
} from "@/lib/subscriptions";
import { cn } from "@/lib/utils";

// Settings > Calendar subscriptions: external .ics feeds shown read-only
export function SubscriptionSettings() {
  const { subscriptions, loading, add, update, remove, refresh } = useSubscriptions();
  const nextColor = SUBSCRIPTION_COLOR_KEYS[subscriptions.length % SUBSCRIPTION_COLOR_KEYS.length];

  return (
    <section id="calendars" className="scroll-mt-6 space-y-4 rounded-lg border bg-card p-5">
      <div>
        <h2 className="font-semibold">Calendar subscriptions</h2>
        <p className="text-sm text-muted-foreground">
          Show another calendar next to your own, read-only: a class timetable, a shared calendar, sports fixtures…
          Paste its iCalendar (.ics or webcal) link. It refreshes every hour.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        subscriptions.length > 0 && (
          <ul className="divide-y rounded-md border">
            {subscriptions.map((sub) => (
              <SubscriptionRow
                key={sub.id}
                subscription={sub}
                onUpdate={(input) => update(sub.id, input)}
                onRefresh={() => refresh(sub.id)}
                onRemove={() => remove(sub.id)}
              />
            ))}
          </ul>
        )
      )}

      <AddSubscriptionForm
        // Remount after each add so the form clears and picks the next color
        key={subscriptions.length}
        defaultColor={nextColor}
        onAdd={add}
      />

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Where do I find a calendar&apos;s link?</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>ADE (university timetables)</strong>: open your timetable, choose the export / &ldquo;Exporter
            l&apos;agenda&rdquo; option, generate the URL and copy it.
          </li>
          <li>
            <strong>Google Calendar</strong>: Settings → the calendar → &ldquo;Secret address in iCal format&rdquo;.
          </li>
          <li>
            <strong>Outlook</strong>: Settings → Calendar → Shared calendars → Publish a calendar → ICS link.
          </li>
        </ul>
      </details>
    </section>
  );
}

function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: SubscriptionColor;
  onChange: (color: SubscriptionColor) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1.5">
      {SUBSCRIPTION_COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          aria-label={SUBSCRIPTION_COLORS[key].label}
          onClick={() => onChange(key)}
          className={cn(
            "size-5 rounded-full outline-none ring-offset-2 ring-offset-card focus-visible:ring-2 focus-visible:ring-ring",
            SUBSCRIPTION_COLORS[key].dot,
            value === key && "ring-2 ring-foreground/60"
          )}
        />
      ))}
    </div>
  );
}

function SubscriptionRow({
  subscription: sub,
  onUpdate,
  onRefresh,
  onRemove,
}: {
  subscription: CalendarSubscription;
  onUpdate: (input: Partial<Pick<CalendarSubscription, "name" | "color" | "enabled">>) => unknown;
  onRefresh: () => Promise<CalendarSubscription | null>;
  onRemove: () => unknown;
}) {
  const format = useFormat();
  const [name, setName] = useState(sub.name);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed) return setName(sub.name);
    if (trimmed !== sub.name) onUpdate({ name: trimmed });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const updated = await onRefresh();
    setRefreshing(false);
    if (updated && !updated.lastError) toast.success(`${updated.name} is up to date`);
  };

  return (
    <li className="space-y-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          maxLength={60}
          aria-label="Calendar name"
          className="h-8 w-48 font-medium"
        />
        <ColorPicker
          value={sub.color}
          onChange={(color) => onUpdate({ color })}
          label={`Color for ${sub.name}`}
        />
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label={`Refresh ${sub.name}`}
            title="Refresh now"
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          </Button>
          {confirmDelete ? (
            <>
              <Button variant="destructive" size="sm" className="h-8" onClick={onRemove}>
                Remove
              </Button>
              <Button variant="ghost" size="sm" className="h-8" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              aria-label={`Remove ${sub.name}`}
              title="Remove"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>
      <p className="truncate text-xs text-muted-foreground" title={sub.url}>
        {sub.url}
      </p>
      <p className={cn("text-xs", sub.lastError ? "text-destructive" : "text-muted-foreground")}>
        {sub.lastError
          ? `Last refresh failed: ${sub.lastError}. Showing the last copy that worked.`
          : sub.lastFetchedAt
            ? `Updated ${formatRelative(sub.lastFetchedAt, undefined, format.day)}`
            : "Not fetched yet"}
        {!sub.enabled && " · Hidden on the calendar"}
      </p>
    </li>
  );
}

function AddSubscriptionForm({
  defaultColor,
  onAdd,
}: {
  defaultColor: SubscriptionColor;
  onAdd: (input: { name: string; url: string; color: SubscriptionColor }) => Promise<{ error?: string }>;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [color, setColor] = useState<SubscriptionColor>(defaultColor);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return setError("Give the calendar a name and paste its link");
    setError(null);
    setAdding(true);
    // The server fetches the link first, so this can take a few seconds
    const result = await onAdd({ name: name.trim(), url: url.trim(), color });
    setAdding(false);
    if (result.error) setError(result.error);
    else toast.success(`Subscribed to ${name.trim()}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border border-dashed p-3">
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
        <div className="space-y-2">
          <Label htmlFor="sub-name">Name</Label>
          <Input
            id="sub-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Timetable"
            maxLength={60}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub-url">Calendar link</Label>
          <Input
            id="sub-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://… or webcal://…"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ColorPicker value={color} onChange={setColor} label="Color for the new calendar" />
        <Button type="submit" size="sm" className="ml-auto" disabled={adding}>
          {adding ? (
            <>
              <RefreshCw className="size-4 mr-1 animate-spin" /> Checking…
            </>
          ) : (
            <>
              <Plus className="size-4 mr-1" /> Subscribe
            </>
          )}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
