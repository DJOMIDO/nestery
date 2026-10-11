// src/components/settings/LanguageTimeSettings.tsx
"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings, type SettingsInput } from "@/components/SettingsProvider";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config";
import {
  createFormatter,
  DATE_LOCALES,
  type DateLocale,
  type HourCycle,
  type WeekStart,
} from "@/lib/format";

// A fixed sample moment for the previews: Monday, September 28, 2026, 2:30 PM
const SAMPLE = new Date(2026, 8, 28, 14, 30);

// Settings > Language & time: the interface language, then how dates and
// times are written (by default as the language writes them)
export function LanguageTimeSettings() {
  const t = useTranslations("settings.languageTime");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const locale = useLocale();
  const { settings, loading, save } = useSettings();
  const { language, dateLocale, hourCycle, weekStart } = settings;

  const apply = async (input: SettingsInput) => {
    if (await save(input)) toast.success(tCommon("saved"));
  };

  // The server sets the language cookie; rendering again switches the text.
  // The page changing language is the confirmation, so no toast.
  const changeLanguage = async (value: string) => {
    if (await save({ language: value === "auto" ? null : (value as Locale) })) router.refresh();
  };

  // Preview a candidate choice with the other settings unchanged
  const preview = (change: Partial<typeof settings>) =>
    createFormatter({ dateLocale, hourCycle, weekStart, ...change }, locale);

  return (
    <section className="space-y-5 rounded-lg border bg-card p-5">
      <div>
        <h2 className="font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingSelect
          id="language"
          label={t("language")}
          value={language ?? "auto"}
          disabled={loading}
          onChange={changeLanguage}
          // Each language in its own words, so anyone can find theirs
          options={[
            { value: "auto", label: t("languageAuto") },
            ...LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] })),
          ]}
        />
        <SettingSelect
          id="date-format"
          label={t("dateFormat")}
          value={dateLocale ?? "auto"}
          disabled={loading}
          onChange={(v) => apply({ dateLocale: v === "auto" ? null : (v as DateLocale) })}
          options={[
            {
              value: "auto",
              label: t("dateMatchLanguage"),
              hint: preview({ dateLocale: null }).dayWithWeekday(SAMPLE),
            },
            ...DATE_LOCALES.map(({ value, label }) => ({
              value,
              label,
              hint: preview({ dateLocale: value }).dayWithWeekday(SAMPLE),
            })),
          ]}
        />
        <SettingSelect
          id="time-format"
          label={t("timeFormat")}
          value={hourCycle ?? "auto"}
          disabled={loading}
          onChange={(v) => apply({ hourCycle: v === "auto" ? null : (v as HourCycle) })}
          options={[
            { value: "auto", label: t("timeMatchDate"), hint: preview({ hourCycle: null }).time(SAMPLE) },
            { value: "h12", label: t("hour12"), hint: preview({ hourCycle: "h12" }).time(SAMPLE) },
            { value: "h23", label: t("hour24"), hint: preview({ hourCycle: "h23" }).time(SAMPLE) },
          ]}
        />
        <SettingSelect
          id="week-start"
          label={t("weekStart")}
          value={String(weekStart)}
          disabled={loading}
          onChange={(v) => apply({ weekStart: Number(v) as WeekStart })}
          options={[
            { value: "1", label: t("monday") },
            { value: "0", label: t("sunday") },
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
