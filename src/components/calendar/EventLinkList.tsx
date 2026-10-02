// src/components/calendar/EventLinkList.tsx
"use client";

import { ExternalLink, Link2, Video } from "lucide-react";
import { eventKey, type CalendarEvent } from "@/lib/calendar";
import { eventLink, type EventLink } from "@/lib/meetingLinks";

export interface LinkedEvent {
  event: CalendarEvent;
  link: EventLink;
}

// The events that have a link to open, each once (multi-day events and
// occurrences of a series keep their own key)
export function linkedEvents(events: CalendarEvent[]): LinkedEvent[] {
  const seen = new Set<string>();
  const linked: LinkedEvent[] = [];
  for (const event of events) {
    const key = eventKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    const link = eventLink(event);
    if (link) linked.push({ event, link });
  }
  return linked;
}

interface EventLinkListProps {
  items: LinkedEvent[];
  // When each event happens, e.g. "3:00 PM – 4:00 PM"
  whenOf: (event: CalendarEvent) => string;
}

// Opens an event's link in a new tab: "Join" for a meeting, "Open" otherwise.
// `withLabel` adds the platform in front ("Teams · Join").
export function EventLinkButton({ link, title, withLabel }: { link: EventLink; title: string; withLabel?: boolean }) {
  const Icon = link.meeting ? Video : Link2;
  const action = link.meeting ? "Join" : "Open";
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      title={link.url}
      aria-label={`${action} ${title} (${link.label})`}
      className="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs font-medium hover:bg-leaf-soft hover:text-leaf"
    >
      {withLabel && (
        <>
          <Icon className="size-3.5 shrink-0 text-leaf" />
          <span className="truncate">{link.label}</span>
          <span className="text-muted-foreground">·</span>
        </>
      )}
      {action}
      <ExternalLink className="size-3 shrink-0" />
    </a>
  );
}

// One row per event: title, platform and time, and a button that opens the link
export function EventLinkList({ items, whenOf }: EventLinkListProps) {
  return (
    <ul className="space-y-2">
      {items.map(({ event, link }) => {
        const Icon = link.meeting ? Video : Link2;
        return (
          <li key={eventKey(event)} className="flex items-center gap-3">
            <span className="rounded-md bg-leaf-soft p-1.5 text-leaf">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" title={event.title}>
                {event.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">{link.label}</span> · {whenOf(event)}
              </p>
            </div>
            <EventLinkButton link={link} title={event.title} />
          </li>
        );
      })}
    </ul>
  );
}
