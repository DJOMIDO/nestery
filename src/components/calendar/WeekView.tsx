// src/components/calendar/WeekView.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarChip } from "@/components/calendar/CalendarItemView";
import { SUBSCRIPTION_COLORS } from "@/lib/subscriptions";
import { DayDrop, DraggableItem, ResizeHandle } from "@/components/calendar/dnd";
import { useFormat } from "@/components/SettingsProvider";
import {
  DAY_MINUTES,
  SNAP_MINUTES,
  eventKey,
  snapMinutes,
  timedSegments,
  type CalendarEvent,
  type CalendarItem,
} from "@/lib/calendar";
import { toDateKey } from "@/lib/tasks";
import { cn } from "@/lib/utils";

// Height of one hour in the time grid
export const HOUR_PX = 48;
export const PX_PER_MINUTE = HOUR_PX / 60;
// Scrolled into view when the week opens
const FIRST_VISIBLE_HOUR = 8;
const MAX_ALL_DAY = 3;

interface WeekViewProps {
  days: string[];
  items: Map<string, CalendarItem[]>;
  events: CalendarEvent[];
  today: string;
  selected: string;
  onSelect: (day: string) => void;
  onOpen: (item: CalendarItem) => void;
  // Click on an empty slot: new event starting there (minutes from midnight)
  onCreateAt: (day: string, minutes: number) => void;
  // While an event's end is being dragged: its eventKey and the change in minutes
  resizing?: { eventId: string; minutes: number } | null;
}

export function WeekView({ days, items, events, today, selected, onSelect, onOpen, onCreateAt, resizing }: WeekViewProps) {
  const format = useFormat();
  const segments = useMemo(() => timedSegments(events, days), [events, days]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = useNow();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isThisWeek = days.includes(toDateKey(now));

  // Open at the start of a normal day rather than at midnight
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: FIRST_VISIBLE_HOUR * HOUR_PX - 8 });
  }, []);

  // Everything that has no time slot goes in the all-day row
  const allDayItems = (day: string) =>
    (items.get(day) ?? []).filter(
      (item) => item.kind === "holiday" || item.kind === "task" || (item.kind === "event" && item.event.allDay)
    );

  const hours = Array.from({ length: 24 }, (_, h) => h);
  const columns = "grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]";

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-lg border bg-card">
      {/* Day headers */}
      <div className={cn(columns, "border-b")}>
        <span />
        {days.map((day) => {
          const isToday = day === today;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(day)}
              aria-pressed={day === selected}
              aria-current={isToday ? "date" : undefined}
              aria-label={format.dayLong(day)}
              className={cn(
                "flex flex-col items-center gap-0.5 border-l py-1.5 text-xs outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                day === selected && "bg-leaf-soft/40"
              )}
            >
              <span className="text-muted-foreground">{format.weekday(day)}</span>
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-sm",
                  isToday && "bg-forest font-semibold text-white"
                )}
              >
                {Number(day.slice(8))}
              </span>
            </button>
          );
        })}
      </div>

      {/* All-day row: holidays, all-day events, tasks due */}
      <div className={cn(columns, "border-b")}>
        <span className="self-center pr-2 text-right text-[10px] text-muted-foreground">All day</span>
        {days.map((day) => {
          const list = allDayItems(day);
          const hidden = list.length - MAX_ALL_DAY;
          return (
            <DayDrop key={day} day={day} className="flex min-h-9 min-w-0 flex-col gap-0.5 border-l p-1">
              {list.slice(0, MAX_ALL_DAY).map((item) => (
                <DraggableItem key={item.id} item={item} day={day} onOpen={onOpen}>
                  <CalendarChip item={item} />
                </DraggableItem>
              ))}
              {hidden > 0 && (
                <button
                  type="button"
                  onClick={() => onSelect(day)}
                  className="px-1.5 text-left text-[11px] text-muted-foreground hover:text-foreground"
                >
                  +{hidden} more
                </button>
              )}
            </DayDrop>
          );
        })}
      </div>

      {/* Time grid */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn(columns, "relative")} style={{ height: 24 * HOUR_PX }}>
          {/* Hour labels */}
          <div className="relative">
            {hours.slice(1).map((h) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground"
                style={{ top: h * HOUR_PX }}
              >
                {format.time(new Date(2000, 0, 1, h))}
              </span>
            ))}
          </div>

          {days.map((day) => (
            <DayDrop
              key={day}
              day={day}
              timed
              className="relative border-l"
              // Click on empty space: a new event at that (snapped) time
              onClick={(e) => {
                if (e.target !== e.currentTarget) return;
                const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                const minutes = Math.floor(y / PX_PER_MINUTE / SNAP_MINUTES) * SNAP_MINUTES;
                onCreateAt(day, Math.min(Math.max(minutes, 0), DAY_MINUTES - 60));
              }}
            >
              {/* Hour lines */}
              {hours.slice(1).map((h) => (
                <div
                  key={h}
                  className="pointer-events-none absolute inset-x-0 border-t border-border/60"
                  style={{ top: h * HOUR_PX }}
                />
              ))}

              {(segments.get(day) ?? []).map((segment) => {
                const { event } = segment;
                // Only the last day's segment has the end that can be dragged
                const endsHere = day === toDateKey(new Date(Date.parse(event.endsAt!) - 1));
                const resizeBy = resizing?.eventId === eventKey(event) && endsHere ? resizing.minutes : 0;
                const end = Math.min(
                  Math.max(segment.end + snapMinutes(resizeBy), segment.start + SNAP_MINUTES),
                  DAY_MINUTES
                );
                const height = Math.max(end - segment.start, SNAP_MINUTES) * PX_PER_MINUTE;
                const item: CalendarItem = { kind: "event", id: `e-${eventKey(event)}-${day}`, event, time: event.startsAt };
                return (
                  <DraggableItem
                    key={item.id}
                    item={item}
                    day={day}
                    onOpen={onOpen}
                    className={cn(
                      "absolute overflow-hidden rounded-md border px-1.5 py-0.5 text-[11px] leading-tight",
                      event.source
                        ? cn(SUBSCRIPTION_COLORS[event.source.color].chip, "border-black/5 dark:border-white/10")
                        : "border-leaf/30 bg-leaf-soft text-leaf"
                    )}
                    style={{
                      top: segment.start * PX_PER_MINUTE,
                      height,
                      left: `calc(${(segment.column / segment.columns) * 100}% + 2px)`,
                      width: `calc(${100 / segment.columns}% - 4px)`,
                    }}
                  >
                    <p className="truncate font-medium">{event.title}</p>
                    {height >= 28 && (
                      <p className="truncate opacity-80">
                        {format.time(event.startsAt!)} – {format.time(event.endsAt!)}
                      </p>
                    )}
                    {endsHere && !event.source && <ResizeHandle event={event} day={day} />}
                  </DraggableItem>
                );
              })}

              {/* Current time */}
              {isThisWeek && day === today && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
                  style={{ top: nowMinutes * PX_PER_MINUTE }}
                  aria-hidden
                >
                  <span className="-ml-1 size-2 rounded-full bg-rose-500" />
                  <span className="h-px flex-1 bg-rose-500" />
                </div>
              )}
            </DayDrop>
          ))}
        </div>
      </div>
    </div>
  );
}

// The current time, refreshed every minute for the "now" line
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
