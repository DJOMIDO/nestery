// src/components/settings/DateTimeSettings.tsx
"use client";

import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings, type SettingsInput } from "@/components/SettingsProvider";
import {
  createFormatter,
  DATE_LOCALES,
  type DateLocale,
  type HourCycle,
  type WeekStart,
} from "@/lib/format";

// A fixed sample moment for the previews: Monday, September 28, 2026, 2:30 PM
const SAMPLE = new Date(2026, 8, 28, 14, 30);

export function DateTimeSettings() {
  const { settings, loading, save } = useSettings();
  const { dateLocale, hourCycle, weekStart } = settings;

  const apply = async (input: SettingsInput) => {
    if (await save(input)) toast.success("Saved");
  };

  // Preview a candidate choice with the other settings unchanged
  const preview = (change: Partial<typeof settings>) =>
    createFormatter({ dateLocale, hourCycle, weekStart, ...change });

  return (
    <section className="space-y-5 rounded-lg border bg-card p-5">
      <div>
        <h2 className="font-semibold">Date &amp; time</h2>
        <p className="text-sm text-muted-foreground">How dates and times are shown across Nestery.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SettingSelect
          id="date-format"
          label="Date format"
          value={dateLocale}
          disabled={loading}
          onChange={(v) => apply({ dateLocale: v as DateLocale })}
          options={DATE_LOCALES.map(({ value, label }) => ({
            value,
            label,
            hint: preview({ dateLocale: value }).dayWithWeekday(SAMPLE),
          }))}
        />
        <SettingSelect
          id="time-format"
          label="Time format"
          value={hourCycle ?? "auto"}
          disabled={loading}
          onChange={(v) => apply({ hourCycle: v === "auto" ? null : (v as HourCycle) })}
          options={[
            { value: "auto", label: "Match date format", hint: preview({ hourCycle: null }).time(SAMPLE) },
            { value: "h12", label: "12-hour", hint: preview({ hourCycle: "h12" }).time(SAMPLE) },
            { value: "h23", label: "24-hour", hint: preview({ hourCycle: "h23" }).time(SAMPLE) },
          ]}
        />
        <SettingSelect
          id="week-start"
          label="Week starts on"
          value={String(weekStart)}
          disabled={loading}
          onChange={(v) => apply({ weekStart: Number(v) as WeekStart })}
          options={[
            { value: "1", label: "Monday" },
            { value: "0", label: "Sunday" },
          ]}
        />
      </div>
    </section>
  );
}

function SettingSelect({
  id,
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string; hint?: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
              {o.hint && <span className="text-muted-foreground">· {o.hint}</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
