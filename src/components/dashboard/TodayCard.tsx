// src/components/dashboard/TodayCard.tsx

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarDays, CalendarClock, CircleCheck, CloudSun, PartyPopper, Umbrella } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CardHeading } from "./CardHeading";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { useHolidays } from "@/hooks/useHolidays";
import { useWeather } from "@/hooks/useWeather";
import { useFormat, useHolidayCountries } from "@/components/SettingsProvider";
import { eventDays, eventKey, type CalendarEvent } from "@/lib/calendar";
import { toDateKey, type Task } from "@/lib/tasks";
import { weatherLabel, type TodayWeather } from "@/lib/weather";

const MAX_EVENTS = 3;

const WET_LABELS: Record<NonNullable<TodayWeather["wetKind"]>, string> = {
  rain: "Rain likely",
  snow: "Snow likely",
  storm: "Storms likely",
};

// Today's date and weather, events and tasks due, and the next public holiday
export function TodayCard({ tasks, events }: { tasks: Task[]; events: CalendarEvent[] }) {
  const format = useFormat();
  const now = new Date();
  const today = toDateKey(now);
  const year = now.getFullYear();

  const { countries } = useHolidayCountries();
  // Next year too, so December still shows the next holiday
  const years = useMemo(() => [year, year + 1], [year]);
  const holidays = useHolidays(countries, years);
  const nextHoliday = holidays.find((h) => h.date >= today);

  const todaysEvents = events
    .filter((e) => {
      const { first, last } = eventDays(e);
      return first <= today && today <= last;
    })
    .sort((a, b) => Number(!a.allDay) - Number(!b.allDay) || (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));
  const dueToday = tasks.filter((t) => t.status !== "done" && t.dueDate === today).length;

  const weekday = format.weekday(now).toUpperCase();

  const { weather, needsPlace } = useWeather();
  // "YYYY-MM-DDTHH", to compare with the forecast's local hours
  const currentHour = `${today}T${String(now.getHours()).padStart(2, "0")}`;

  return (
    <Card className="w-full h-full rounded-lg shadow-sm bg-card hover:shadow-md">
      <CardContent className="p-4">
        <Link href="/calendar" className="block" aria-label="Open calendar">
          <CardHeading
            title="Today"
            icon={CalendarDays}
            aside={
              weather && (
                <span
                  className="flex min-w-0 items-center gap-1.5 text-sm"
                  title={`${weatherLabel(weather.current.code)} in ${weather.place}, ${weather.high}° / ${weather.low}° today`}
                >
                  <WeatherIcon code={weather.current.code} isDay={weather.current.isDay} className="size-4 shrink-0 text-leaf" />
                  <span className="font-semibold">{weather.current.temperature}°</span>
                  {/* Three columns leave little room on medium screens */}
                  <span className="text-xs text-muted-foreground md:hidden xl:inline">
                    {weather.high}°/{weather.low}°
                  </span>
                </span>
              )
            }
          />
        </Link>

        <div className="flex items-start space-x-4">
          <div className="flex flex-col items-center flex-shrink-0">
            <p className="text-sm font-bold text-bark">{weekday}</p>
            <p className="text-4xl font-extrabold leading-none">{now.getDate()}</p>
          </div>

          <ul className="flex-1 min-w-0 space-y-1 text-sm">
            {todaysEvents.slice(0, MAX_EVENTS).map((event) => (
              <li key={eventKey(event)} className="flex items-center gap-2 min-w-0">
                <CalendarClock className="size-3.5 shrink-0 text-leaf" />
                <span className="shrink-0 text-xs text-muted-foreground">
                  {event.allDay || eventDays(event).first !== today ? "All day" : format.time(event.startsAt!)}
                </span>
                <span className="truncate">{event.title}</span>
              </li>
            ))}
            {todaysEvents.length > MAX_EVENTS && (
              <li className="text-xs text-muted-foreground">
                +{todaysEvents.length - MAX_EVENTS} more events
              </li>
            )}
            {dueToday > 0 && (
              <li>
                <Link href="/tasks" className="flex items-center gap-2 hover:underline">
                  <CircleCheck className="size-3.5 shrink-0 text-leaf" />
                  {dueToday} {dueToday === 1 ? "task" : "tasks"} due today
                </Link>
              </li>
            )}
            {todaysEvents.length === 0 && dueToday === 0 && (
              <li className="text-muted-foreground">Nothing planned today.</li>
            )}
            {weather?.wetFrom && (
              <li className="flex items-center gap-2 min-w-0">
                <Umbrella className="size-3.5 shrink-0 text-leaf" />
                <span className="truncate">
                  {WET_LABELS[weather.wetKind ?? "rain"]}{" "}
                  {weather.wetFrom.slice(0, 13) <= currentHour ? "now" : `from ${format.time(weather.wetFrom)}`}
                </span>
              </li>
            )}
            {needsPlace && (
              <li>
                <Link
                  href="/settings?section=weather"
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  <CloudSun className="size-3.5 shrink-0" /> Choose a place to see the weather
                </Link>
              </li>
            )}
            {nextHoliday && (
              <li className="flex items-center gap-2 min-w-0 pt-1 text-xs text-muted-foreground">
                <PartyPopper className="size-3.5 shrink-0 text-bark" />
                <span className="truncate">
                  {nextHoliday.date === today ? "Today" : format.day(nextHoliday.date)} ·{" "}
                  {nextHoliday.localName} ({nextHoliday.countryCode})
                </span>
              </li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
