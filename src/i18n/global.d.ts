// Types next-intl's keys and locales from the English messages, so a
// mistyped key or a missing translation shows up as a type error
import type { Locale } from "@/i18n/config";
import type messages from "@/i18n/messages/en.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
