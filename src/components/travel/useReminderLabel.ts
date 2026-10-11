// src/components/travel/useReminderLabel.ts

import { useTranslations } from "next-intl";
import { reminderParts } from "@/lib/travel";

// "3 hours before" for a journey reminder's lead time, in the interface language
export function useReminderLabel() {
  const t = useTranslations("travel.remind");
  return (minutes: number) => t("before", reminderParts(minutes));
}
