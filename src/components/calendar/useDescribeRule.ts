// src/components/calendar/useDescribeRule.ts

import { useLocale, useTranslations } from "next-intl";
import { useFormat } from "@/components/SettingsProvider";
import type { RecurrenceRule } from "@/lib/recurrence";

// Describes a repeat rule in the interface language, e.g. "Every 2 weeks on
// Mon and Wed, until Dec 31, 2026" or "每 2 周的周一和周三，直到 2026年12月31日"
export function useDescribeRule() {
  const t = useTranslations("calendar.rule");
  const locale = useLocale();
  const format = useFormat();
  const list = new Intl.ListFormat(locale, { type: "conjunction" });

  return (rule: RecurrenceRule) => {
    let text = t("every", { freq: rule.freq, interval: rule.interval });
    if (rule.freq === "WEEKLY" && rule.byDay?.length) {
      // Monday first, named as the date format writes weekdays
      const days = [...rule.byDay]
        .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
        .map((d) => format.weekday(new Date(2024, 0, 7 + d)));
      text += t("onDays", { days: list.format(days) });
    }
    if (rule.count) text += t("count", { count: rule.count });
    if (rule.until) text += t("until", { date: format.dayWithYear(rule.until) });
    return text;
  };
}
