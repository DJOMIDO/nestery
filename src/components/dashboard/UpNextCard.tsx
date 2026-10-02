// src/components/dashboard/UpNextCard.tsx

"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import { AlarmClock, CalendarRange, Link2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CardHeading } from "./CardHeading";
import { CalendarRow, eventWhen } from "@/components/calendar/CalendarItemView";
import { EventLinkList, linkedEvents } from "@/components/calendar/EventLinkList";
import { useFormat, useHolidayCountries } from "@/components/SettingsProvider";
import { useHolidays } from "@/hooks/useHolidays";
import { itemsByDay, type CalendarEvent, type CalendarItem } from "@/lib/calendar";
import { addDays, compareTasks, toDateKey, type Task } from "@/lib/tasks";

const DAYS = 7;

interface UpNextProps {
  tasks: Task[];
  // Events (own and subscribed) overlapping the next 7 days
  events: CalendarEvent[];
  today: string;
}

// Where an item opens: events on the calendar, tasks on the task list
const hrefOf = (item: CalendarItem) =>
  item.kind === "event" ? "/calendar" : item.kind === "task" ? "/tasks" : null;

// The next 7 days as one agenda: events, task due dates and holidays by day,
// with overdue tasks first. Reminders have their own card.
export function UpNextCard({ tasks, events, today }: UpNextProps) {
  const format = useFormat();
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(today, i)), [today]);

  const { countries } = useHolidayCountries();
  const years = useMemo(() => [...new Set([days[0], days[DAYS - 1]].map((d) => Number(d.slice(0, 4))))], [days]);
  const holidays = useHolidays(countries, years);

  const byDay = useMemo(() => itemsByDay(days, { events, tasks, holidays }), [days, events, tasks, holidays]);
  const overdue = tasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today).sort(compareTasks);

  const dayLabel = (day: string) =>
    day === today ? "Today" : day === addDays(today, 1) ? "Tomorrow" : format.dayWithWeekday(day);

  const sections = days
    .map((day) => ({
      day,
      items: (byDay.get(day) ?? []).filter(
        (item) => item.kind !== "reminder" && !(item.kind === "task" && item.task.status === "done")
      ),
    }))
    .filter((s) => s.items.length > 0);

  // Events with a join (or other) link, in agenda order; a multi-day event once
  const linked = linkedEvents(
    sections.flatMap(({ items }) => items.flatMap((item) => (item.kind === "event" ? [item.event] : [])))
  );
  const linkWhen = (event: CalendarEvent) => {
    const day = event.allDay ? event.startDate! : toDateKey(new Date(event.startsAt!));
    return `${day < today ? "Today" : dayLabel(day)} · ${eventWhen(event, format)}`;
  };
  const linksSection = linked.length > 0 && (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Link2 className="size-3.5" /> Links
      </h3>
      <EventLinkList items={linked} whenOf={linkWhen} />
    </section>
  );

  return (
    <Card className="w-full h-full rounded-lg shadow-sm bg-card hover:shadow-md">
      <CardContent className="p-4 flex flex-col min-h-0 flex-1">
        <CardHeading title="Up next" icon={CalendarRange} />

        {/* -mx-1 px-1 makes room for the lists' -mx-1, so they don't scroll sideways */}
        <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
          {overdue.length > 0 && (
            <section>
              <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                <AlarmClock className="size-3.5" /> Overdue
              </h3>
              <ul className="-mx-1">
                {overdue.map((task) => (
                  <li key={task.id}>
                    <AgendaLink href="/tasks">
                      <CalendarRow item={{ kind: "task", id: `t-${task.id}`, task }} />
                    </AgendaLink>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Links follow Today, or come first when nothing is on today */}
          {sections[0]?.day !== today && linksSection}

          {sections.map(({ day, items }) => (
            <Fragment key={day}>
              <section>
                <h3 className="mb-1 text-xs font-semibold text-muted-foreground">{dayLabel(day)}</h3>
                <ul className="-mx-1">
                  {items.map((item) => {
                    const href = hrefOf(item);
                    return (
                      <li key={item.id}>
                        {href ? (
                          <AgendaLink href={href}>
                            <CalendarRow item={item} />
                          </AgendaLink>
                        ) : (
                          <div className="px-1 py-1.5">
                            <CalendarRow item={item} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
              {day === today && linksSection}
            </Fragment>
          ))}

          {overdue.length === 0 && sections.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing planned for the next 7 days.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AgendaLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block rounded-md px-1 py-1.5 hover:bg-muted/60">
      {children}
    </Link>
  );
}
