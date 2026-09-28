// src/components/calendar/DayAgenda.tsx
"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarRow } from "@/components/calendar/CalendarItemView";
import { useFormat } from "@/components/SettingsProvider";
import type { CalendarItem } from "@/lib/calendar";

interface DayAgendaProps {
  day: string;
  items: CalendarItem[];
  onOpen: (item: CalendarItem) => void;
  onNewEvent: () => void;
}

// Everything on one day, in full
export function DayAgenda({ day, items, onOpen, onNewEvent }: DayAgendaProps) {
  const title = useFormat().dayLong(day);

  return (
    <section aria-label={`Agenda for ${title}`} className="flex min-h-0 flex-col rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <Button variant="ghost" size="icon" className="size-8" onClick={onNewEvent} aria-label="New event on this day">
          <Plus className="size-4" />
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing planned.</p>
      ) : (
        <ul className="-mx-2 min-h-0 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id}>
              {item.kind === "holiday" ? (
                <div className="px-2 py-1.5">
                  <CalendarRow item={item} />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className="w-full rounded-md px-2 py-1.5 text-left hover:bg-muted"
                >
                  <CalendarRow item={item} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
