// src/components/calendar/RepeatFields.tsx
"use client";

import { useFormat } from "@/components/SettingsProvider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { describeRule, type Frequency, type RecurrenceRule } from "@/lib/recurrence";
import { addDays } from "@/lib/tasks";
import { cn } from "@/lib/utils";

const UNITS: Record<Frequency, [string, string]> = {
  DAILY: ["day", "days"],
  WEEKLY: ["week", "weeks"],
  MONTHLY: ["month", "months"],
  YEARLY: ["year", "years"],
};

type Ends = "never" | "until" | "count";

const weekdayOf = (date: string) => new Date(`${date}T00:00`).getDay();

interface RepeatFieldsProps {
  rule: RecurrenceRule | null;
  onChange: (rule: RecurrenceRule | null) => void;
  // The event's start date: default weekday for weekly, earliest "until"
  startDate: string;
}

// "Does not repeat", or how often and until when
export function RepeatFields({ rule, onChange, startDate }: RepeatFieldsProps) {
  const format = useFormat();
  const ends: Ends = rule?.until ? "until" : rule?.count ? "count" : "never";

  const setFrequency = (value: string) => {
    if (value === "none") return onChange(null);
    const freq = value as Frequency;
    onChange({
      freq,
      interval: rule?.interval ?? 1,
      byDay: freq === "WEEKLY" ? (rule?.byDay?.length ? rule.byDay : [weekdayOf(startDate)]) : undefined,
      count: rule?.count,
      until: rule?.until,
    });
  };

  const update = (change: Partial<RecurrenceRule>) => rule && onChange({ ...rule, ...change });

  const setEnds = (value: Ends) =>
    update({
      count: value === "count" ? rule?.count ?? 10 : undefined,
      until: value === "until" ? rule?.until ?? addDays(startDate, 30) : undefined,
    });

  // Weekday buttons in the user's week order; values are 0 = Sunday … 6 = Saturday
  const weekdays = format.weekdayNames("narrow").map((label, i) => ({
    label,
    value: (format.weekStart + i) % 7,
    name: format.weekdayNames("short")[i],
  }));

  const toggleDay = (day: number) => {
    const current = rule?.byDay ?? [];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    // At least one day stays selected
    if (next.length > 0) update({ byDay: next });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="event-repeat">Repeat</Label>
          <Select value={rule?.freq ?? "none"} onValueChange={setFrequency}>
            <SelectTrigger id="event-repeat" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Does not repeat</SelectItem>
              <SelectItem value="DAILY">Daily</SelectItem>
              <SelectItem value="WEEKLY">Weekly</SelectItem>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="YEARLY">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {rule && (
          <div className="flex items-center gap-2 text-sm">
            <Label htmlFor="event-interval" className="font-normal">
              Every
            </Label>
            <Input
              id="event-interval"
              type="number"
              min={1}
              max={99}
              value={rule.interval}
              onChange={(e) => update({ interval: Math.min(Math.max(Number(e.target.value) || 1, 1), 99) })}
              className="w-16"
            />
            <span>{UNITS[rule.freq][rule.interval === 1 ? 0 : 1]}</span>
          </div>
        )}
      </div>

      {rule?.freq === "WEEKLY" && (
        <div role="group" aria-label="Repeat on" className="flex gap-1">
          {weekdays.map(({ label, value, name }) => {
            const on = rule.byDay?.includes(value) ?? false;
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleDay(value)}
                aria-pressed={on}
                aria-label={name}
                className={cn(
                  "size-8 rounded-full border text-xs font-medium transition-colors",
                  on ? "border-leaf bg-leaf text-white" : "hover:bg-muted"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {rule && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Label htmlFor="event-ends" className="font-normal">
            Ends
          </Label>
          <Select value={ends} onValueChange={(v) => setEnds(v as Ends)}>
            <SelectTrigger id="event-ends" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="never">Never</SelectItem>
              <SelectItem value="until">On date</SelectItem>
              <SelectItem value="count">After</SelectItem>
            </SelectContent>
          </Select>
          {ends === "until" && (
            <Input
              type="date"
              value={rule.until}
              min={startDate}
              onChange={(e) => e.target.value && update({ until: e.target.value })}
              aria-label="Repeat until"
              className="w-40"
            />
          )}
          {ends === "count" && (
            <>
              <Input
                type="number"
                min={1}
                max={999}
                value={rule.count}
                onChange={(e) => update({ count: Math.min(Math.max(Number(e.target.value) || 1, 1), 999) })}
                aria-label="Number of times"
                className="w-20"
              />
              <span>times</span>
            </>
          )}
        </div>
      )}

      {rule && (
        <p className="text-xs text-muted-foreground">
          {describeRule(rule, {
            weekdayName: (d) => format.weekday(new Date(2024, 0, 7 + d)),
            formatDay: format.dayWithYear,
          })}
        </p>
      )}
    </div>
  );
}
