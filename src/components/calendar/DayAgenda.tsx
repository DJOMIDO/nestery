// src/components/calendar/DayAgenda.tsx
// Everything on the selected day, beside the calendar: a header with the
// day's weather and counts, the all-day items as chips, the timed ones on a
// timeline (with a "now" line today), then the tasks due, which can be
// ticked off here.
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, Check, Plus, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarChip, EventKindIcon, dotOf, useEventDuration } from "@/components/calendar/CalendarItemView";
import { EventLinkButton } from "@/components/calendar/EventLinkList";
import { useFormat } from "@/components/SettingsProvider";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { useWeatherLabel } from "@/components/weather/useWeatherLabel";
import { eventDays, type CalendarItem } from "@/lib/calendar";
import { addressesIn } from "@/lib/eventContacts";
import { eventLink } from "@/lib/meetingLinks";
import { addDays, type Task } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import type { DailyForecast } from "@/server/weather";

interface DayAgendaProps {
  day: string;
  today: string;
  items: CalendarItem[];
  // The day's forecast at the user's place, when within two weeks
  weather?: DailyForecast;
  onOpen: (item: CalendarItem) => void;
  onNewEvent: () => void;
  onToggleTask: (task: Task) => void;
}

type Timed = Extract<CalendarItem, { kind: "event" | "reminder" }>;

// The current time, updated each minute, for today's "now" line
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function DayAgenda({ day, today, items, weather, onOpen, onNewEvent, onToggleTask }: DayAgendaProps) {
  const t = useTranslations("calendar");
  const tNav = useTranslations("nav");
  const format = useFormat();
  const weatherLabel = useWeatherLabel();
  const now = useNow();
  const title = format.dayLong(day);
  const relative =
    day === today ? t("today") : day === addDays(today, 1) ? t("tomorrow") : day === addDays(today, -1) ? t("yesterday") : null;

  // Untimed events (all-day, or a long event's later days) and holidays
  const allDay = items.filter((i) => i.kind === "holiday" || (i.kind === "event" && !i.time));
  const timed = items.filter((i): i is Timed => (i.kind === "event" && !!i.time) || i.kind === "reminder");
  const tasks = items.filter((i): i is Extract<CalendarItem, { kind: "task" }> => i.kind === "task");

  const eventCount = items.filter((i) => i.kind === "event").length;
  const taskCount = tasks.length + items.filter((i) => i.kind === "reminder").length;
  const summary = [
    eventCount > 0 && t("countEvents", { count: eventCount }),
    taskCount > 0 && t("countTasks", { count: taskCount }),
  ].filter(Boolean);

  // Today, what has ended is dimmed and the "now" line goes before the
  // first item still to come
  const endOf = (item: Timed) =>
    Date.parse(item.kind === "reminder" ? item.time : item.event.endsAt!);
  const isPast = (item: Timed) => day === today && endOf(item) <= now;
  const nowIndex = day === today ? timed.findIndex((i) => !isPast(i)) : -2;

  return (
    <section aria-label={t("agendaFor", { day: title })} className="flex min-h-0 flex-col rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-x-2 font-semibold">
            {title}
            {relative && (
              <span className="rounded-full bg-leaf-soft px-2 py-0.5 text-xs font-medium text-leaf">{relative}</span>
            )}
          </h2>
          {(summary.length > 0 || weather) && (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {summary.length > 0 && <span>{summary.join(" · ")}</span>}
              {weather && (
                <span className="flex items-center gap-1" title={weatherLabel(weather.code)}>
                  <WeatherIcon code={weather.code} className="size-3.5 text-leaf" />
                  {weather.high}°/{weather.low}° {weatherLabel(weather.code)}
                </span>
              )}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={onNewEvent} aria-label={t("newEventOnDay")}>
          <Plus className="size-4" />
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("nothingPlanned")}</p>
      ) : (
        <div className="-mx-2 min-h-0 space-y-4 overflow-y-auto px-2">
          {allDay.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-medium text-muted-foreground">{t("allDayHeading")}</h3>
              <ul className="flex flex-wrap gap-1.5">
                {allDay.map((item) => (
                  <li key={item.id} className="min-w-0 max-w-full">
                    {item.kind === "event" ? (
                      <button type="button" onClick={() => onOpen(item)} className="block max-w-full rounded hover:brightness-95">
                        <CalendarChip item={item} />
                      </button>
                    ) : (
                      <CalendarChip item={item} />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {timed.length > 0 && (
            <ul className="space-y-0.5">
              {timed.map((item, i) => (
                <TimelineRow
                  key={item.id}
                  item={item}
                  day={day}
                  past={isPast(item)}
                  nowBefore={i === nowIndex}
                  onOpen={onOpen}
                />
              ))}
              {nowIndex === -1 && <NowLine />}
            </ul>
          )}

          {tasks.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-xs font-medium text-muted-foreground">{tNav("tasks")}</h3>
              <ul>
                {tasks.map(({ id, task }) => {
                  const done = task.status === "done";
                  return (
                    <li key={id} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted">
                      <button
                        type="button"
                        onClick={() => onToggleTask(task)}
                        aria-label={t("toggleDone", { done: String(done), title: task.title })}
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-sm",
                          done ? "bg-leaf text-white" : "border border-muted-foreground/50 hover:border-leaf"
                        )}
                      >
                        {done && <Check className="size-3" strokeWidth={3} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpen({ kind: "task", id, task })}
                        className={cn("min-w-0 flex-1 truncate text-left text-sm", done && "text-muted-foreground line-through")}
                      >
                        {task.title}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function NowLine() {
  const t = useTranslations("calendar");
  return (
    <li aria-hidden className="flex items-center gap-2 py-1">
      <span className="w-12 text-right text-[11px] font-semibold text-rose-600">{t("now")}</span>
      <span className="size-1.5 rounded-full bg-rose-600" />
      <span className="h-px flex-1 bg-rose-600/60" />
    </li>
  );
}

// A timed event or reminder: its times on the left, its calendar's color,
// then what, how long, where and from which calendar
function TimelineRow({
  item,
  day,
  past,
  nowBefore,
  onOpen,
}: {
  item: Timed;
  day: string;
  past: boolean;
  nowBefore: boolean;
  onOpen: (item: CalendarItem) => void;
}) {
  const t = useTranslations("calendar");
  const format = useFormat();
  const duration = useEventDuration();
  const event = item.kind === "event" ? item.event : null;
  const link = event ? eventLink(event) : null;
  // A long event ends on a later day: no end time under its start
  const end = event && eventDays(event).last === day ? format.time(event.endsAt!) : null;
  const detail = event
    ? [
        duration(event),
        // Where: the location, else an address in the notes
        event.source?.location ?? (event.notes ? addressesIn(event.notes)[0] : null),
        event.source && !event.source.journeyId ? event.source.name : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <>
      {nowBefore && <NowLine />}
      <li className={cn("rounded-md hover:bg-muted", past && "opacity-55")}>
        <button type="button" onClick={() => onOpen(item)} className="flex w-full items-stretch gap-2 px-0 py-1.5 text-left">
          <span className="w-12 shrink-0 text-right tabular-nums">
            <span className="block text-xs font-medium">{format.time(item.time!)}</span>
            {end && <span className="block text-[11px] text-muted-foreground">{end}</span>}
          </span>
          <span className={cn("w-1 shrink-0 rounded-full", dotOf(item))} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-sm font-medium break-words">
              {item.kind === "reminder" ? (
                <Bell className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <EventKindIcon event={event!} className="size-3.5 shrink-0 text-leaf" />
              )}
              <span className="min-w-0">{item.kind === "event" ? item.event.title : item.task.title}</span>
              {event?.rrule && <Repeat className="size-3.5 shrink-0 text-muted-foreground" aria-label={t("repeats")} />}
            </span>
            {detail && <span className="block text-xs text-muted-foreground wrap-anywhere">{detail}</span>}
          </span>
        </button>
        {/* Beside the row, not inside it: a link can't sit in a button */}
        {link && (
          <div className="pb-2 pl-17 pr-2">
            <EventLinkButton link={link} title={event!.title} withLabel />
          </div>
        )}
      </li>
    </>
  );
}
