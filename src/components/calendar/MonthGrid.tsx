// src/components/calendar/MonthGrid.tsx
"use client";

import { CalendarChip, dotOf } from "@/components/calendar/CalendarItemView";
import { DayDrop, DraggableItem } from "@/components/calendar/dnd";
import { useFormat } from "@/components/SettingsProvider";
import type { CalendarItem } from "@/lib/calendar";
import { cn } from "@/lib/utils";

const MAX_CHIPS = 3;

interface MonthGridProps {
  month: string; // YYYY-MM-01
  days: string[];
  items: Map<string, CalendarItem[]>;
  today: string;
  selected: string;
  onSelect: (day: string) => void;
  onOpen: (item: CalendarItem) => void;
}

// Six weeks of days. Wide cells show chips that can be dragged to another day;
// narrow ones show colored dots.
export function MonthGrid({ month, days, items, today, selected, onSelect, onOpen }: MonthGridProps) {
  const format = useFormat();
  const inMonth = (day: string) => day.slice(0, 7) === month.slice(0, 7);

  return (
    <div className="flex flex-1 min-h-0 flex-col rounded-lg border bg-card">
      <div className="grid grid-cols-7 border-b text-center text-xs font-medium text-muted-foreground">
        {format.weekdayNames("short").map((d) => (
          <span key={d} className="py-2">
            {d}
          </span>
        ))}
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-7 grid-rows-6">
        {days.map((day, i) => {
          const dayItems = items.get(day) ?? [];
          const hidden = dayItems.length - MAX_CHIPS;
          const isToday = day === today;
          const isSelected = day === selected;
          return (
            <DayDrop
              key={day}
              day={day}
              onClick={() => onSelect(day)}
              className={cn(
                "flex min-h-16 min-w-0 cursor-pointer flex-col gap-0.5 overflow-hidden border-border p-1 transition-colors hover:bg-muted/60 sm:min-h-24",
                i % 7 !== 6 && "border-r",
                i < 35 && "border-b",
                !inMonth(day) && "bg-muted/30 text-muted-foreground",
                isSelected && "bg-leaf-soft/40 hover:bg-leaf-soft/50"
              )}
            >
              {/* The keyboard way to select a day */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(day);
                }}
                aria-pressed={isSelected}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${format.dayLong(day)}, ${dayItems.length} ${dayItems.length === 1 ? "item" : "items"}`}
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isToday && "bg-forest font-semibold text-white"
                )}
              >
                {Number(day.slice(8))}
              </button>

              {/* Wide: chips */}
              <div className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                {dayItems.slice(0, MAX_CHIPS).map((item) => (
                  <DraggableItem key={item.id} item={item} day={day} onOpen={onOpen}>
                    <CalendarChip item={item} />
                  </DraggableItem>
                ))}
                {hidden > 0 && <span className="px-1.5 text-[11px] text-muted-foreground">+{hidden} more</span>}
              </div>

              {/* Narrow: dots */}
              <span className="flex flex-wrap gap-0.5 px-0.5 sm:hidden">
                {dayItems.slice(0, 4).map((item) => (
                  <span key={item.id} className={cn("size-1.5 rounded-full", dotOf(item))} />
                ))}
              </span>
            </DayDrop>
          );
        })}
      </div>
    </div>
  );
}
