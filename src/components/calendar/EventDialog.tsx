// src/components/calendar/EventDialog.tsx
"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EventInput } from "@/hooks/useEvents";
import type { CalendarEvent } from "@/lib/calendar";
import { toDateKey } from "@/lib/tasks";

interface EventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Event being edited; null to create one on `defaultDate`
  event: CalendarEvent | null;
  defaultDate: string;
  // "HH:MM" start for a new timed event (e.g. the slot clicked in the week view)
  defaultTime?: string;
  onSubmit: (input: EventInput) => Promise<unknown>;
  onDelete?: (event: CalendarEvent) => void;
}

export function EventDialog({ open, onOpenChange, event, defaultDate, defaultTime, onSubmit, onDelete }: EventDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{event ? "Edit Event" : "New Event"}</DialogTitle>
        </DialogHeader>
        {/* The content unmounts when closed, so the form resets on each open */}
        <EventForm
          key={event?.id ?? `new-${defaultDate}-${defaultTime ?? ""}`}
          event={event}
          defaultDate={defaultDate}
          defaultTime={defaultTime}
          onCancel={() => onOpenChange(false)}
          onDelete={
            event && onDelete
              ? () => {
                  onOpenChange(false);
                  onDelete(event);
                }
              : undefined
          }
          onSubmit={async (input) => {
            if (await onSubmit(input)) onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

// "09:05" in local time
const timeOf = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Local date + time -> ISO timestamp with the browser's offset applied
const toIso = (date: string, time: string) => new Date(`${date}T${time}`).toISOString();

// One hour from `start` ("HH:MM"), or the given start; otherwise the next full
// hour when the day is today, else 09:00. Never runs past 23:59.
function defaultTimes(date: string, start?: string) {
  const now = new Date();
  const startMinutes = start
    ? Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5))
    : (date === toDateKey(now) ? Math.min(now.getHours() + 1, 23) : 9) * 60;
  const endMinutes = Math.min(startMinutes + 60, 23 * 60 + 59);
  const hhmm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  return { start: hhmm(startMinutes), end: hhmm(endMinutes) };
}

function EventForm({
  event,
  defaultDate,
  defaultTime,
  onSubmit,
  onCancel,
  onDelete,
}: {
  event: CalendarEvent | null;
  defaultDate: string;
  defaultTime?: string;
  onSubmit: (input: EventInput) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const defaults = defaultTimes(defaultDate, defaultTime);
  const [title, setTitle] = useState(event?.title ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startDate, setStartDate] = useState(
    event ? (event.allDay ? event.startDate! : toDateKey(new Date(event.startsAt!))) : defaultDate
  );
  const [endDate, setEndDate] = useState(
    event ? (event.allDay ? event.endDate! : toDateKey(new Date(event.endsAt!))) : defaultDate
  );
  const [startTime, setStartTime] = useState(event?.startsAt ? timeOf(event.startsAt) : defaults.start);
  const [endTime, setEndTime] = useState(event?.endsAt ? timeOf(event.endsAt) : defaults.end);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Moving the start keeps the end from falling before it
  const changeStartDate = (value: string) => {
    setStartDate(value);
    if (value && endDate < value) setEndDate(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError("Event title is required");
    if (!startDate || !endDate) return setError("Choose a start and end date");

    const timing: EventInput = allDay
      ? { allDay: true, startDate, endDate }
      : { allDay: false, startsAt: toIso(startDate, startTime), endsAt: toIso(endDate, endTime) };
    const ordered = allDay
      ? endDate >= startDate
      : new Date(timing.endsAt!) >= new Date(timing.startsAt!);
    if (!ordered) return setError("The event ends before it starts");

    setError(null);
    setSaving(true);
    await onSubmit({ title: title.trim(), notes: notes.trim() || null, ...timing });
    setSaving(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="event-title">Title</Label>
        <Input
          id="event-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What's happening?"
          maxLength={200}
          autoFocus
        />
      </div>

      <label className="flex w-fit items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={allDay}
          onChange={(e) => setAllDay(e.target.checked)}
          className="size-4 accent-leaf"
        />
        All day
      </label>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="event-start-date">Starts</Label>
          <Input
            id="event-start-date"
            type="date"
            value={startDate}
            onChange={(e) => changeStartDate(e.target.value)}
          />
          {!allDay && (
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              aria-label="Start time"
            />
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="event-end-date">Ends</Label>
          <Input
            id="event-end-date"
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          {!allDay && (
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              aria-label="End time"
            />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="event-notes">Notes</Label>
        <Textarea
          id="event-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Location, details…"
          rows={3}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-2 pt-2">
        {onDelete && (
          <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="w-4 h-4 mr-1" /> Delete
          </Button>
        )}
        <div className="flex-1" />
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : event ? "Save" : "Create"}
        </Button>
      </div>
    </form>
  );
}
