// src/components/calendar/EventDetailsDialog.tsx
"use client";

import { CalendarClock, MapPin, Rss } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { eventWhen } from "@/components/calendar/CalendarItemView";
import { useFormat } from "@/components/SettingsProvider";
import type { CalendarEvent } from "@/lib/calendar";
import { SUBSCRIPTION_COLORS } from "@/lib/subscriptions";
import { cn } from "@/lib/utils";

interface EventDetailsDialogProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Read-only view of an event from a subscribed calendar
export function EventDetailsDialog({ event, open, onOpenChange }: EventDetailsDialogProps) {
  const format = useFormat();
  const source = event?.source;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {event && source && (
          <>
            <DialogHeader>
              <DialogTitle className="break-words">{event.title}</DialogTitle>
              <DialogDescription className="flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", SUBSCRIPTION_COLORS[source.color].dot)} />
                From {source.name} (read-only)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 text-sm">
              <p className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  {format.dayWithWeekday(event.allDay ? event.startDate! : event.startsAt!)} ·{" "}
                  {eventWhen(event, format)}
                </span>
              </p>
              {source.location && (
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="break-words">{source.location}</span>
                </p>
              )}
              {event.notes && (
                <p className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-muted-foreground">
                  {event.notes}
                </p>
              )}
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Rss className="size-3.5" />
                Changes come from the calendar&apos;s source and appear here when it refreshes.
              </p>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
