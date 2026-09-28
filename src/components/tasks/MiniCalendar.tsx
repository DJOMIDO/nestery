// src/components/tasks/MiniCalendar.tsx
"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, startOfWeek, toDateKey } from "@/lib/tasks";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

interface MiniCalendarProps {
  // Dates (YYYY-MM-DD) that have open tasks due, marked with a dot
  markedDates: Set<string>;
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

export function MiniCalendar({
  markedDates,
  selectedDate,
  onSelectDate,
}: MiniCalendarProps) {
  const today = toDateKey(new Date());
  // First day of the displayed month
  const [month, setMonth] = useState(() => today.slice(0, 7) + "-01");

  const [y, m] = month.split("-").map(Number);
  const title = new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const shiftMonth = (delta: number) =>
    setMonth(toDateKey(new Date(y, m - 1 + delta, 1)));

  // Six rows of seven days, starting on the Monday on or before the 1st
  const gridStart = startOfWeek(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => shiftMonth(-1)}
          className="p-1 rounded hover:bg-muted"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold">{title}</span>
        <button
          onClick={() => shiftMonth(1)}
          className="p-1 rounded hover:bg-muted"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-muted-foreground py-1">
            {d}
          </span>
        ))}
        {days.map((day) => {
          const inMonth = day.slice(0, 7) === month.slice(0, 7);
          const selected = day === selectedDate;
          return (
            <button
              key={day}
              onClick={() => onSelectDate(selected ? null : day)}
              aria-label={day}
              aria-pressed={selected}
              className={cn(
                "relative h-8 rounded-md hover:bg-muted",
                !inMonth && "text-muted-foreground/50",
                day === today && "font-bold text-primary",
                selected && "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {Number(day.slice(8))}
              {markedDates.has(day) && (
                <span
                  className={cn(
                    "absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full",
                    selected ? "bg-primary-foreground" : "bg-leaf"
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
