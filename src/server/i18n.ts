// src/server/i18n.ts
// Translating on the server, where there is no React context: emails, API
// errors and other text the server writes for a person.

import { createTranslator } from "next-intl";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { requestLocale } from "@/i18n/request";
import en from "@/i18n/messages/en.json";

export type Messages = typeof en;

export async function messagesFor(locale: Locale): Promise<Messages> {
  return (await import(`@/i18n/messages/${locale}.json`)).default;
}

export async function translatorFor(locale: Locale) {
  return createTranslator({ locale, messages: await messagesFor(locale) });
}

// The language of the current request (cookie, then Accept-Language), or
// English outside one
export async function currentLocale(): Promise<Locale> {
  try {
    return await requestLocale();
  } catch {
    return DEFAULT_LOCALE;
  }
}

// A user's language, for what reaches them outside a page (emails, the
// calendar feed): their saved one, else the current request's (e.g. the page
// they signed up on)
export async function userLocale(userId: string): Promise<Locale> {
  const [row] = await db
    .select({ language: userSettings.language })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return isLocale(row?.language) ? row.language : currentLocale();
}

// ---- Error messages ------------------------------------------------------

// Server code writes its errors in English (zod rules, thrown errors), and
// en.json's serverErrors holds each of them. Translating at the response
// matches the English text to its entry, with "{name}" parts taken from the
// message, e.g. "Could not reach {host}." Text with no entry (a provider's
// own message, say) stays as it is.
type ErrorKey = keyof Messages["serverErrors"];

const ERROR_PATTERNS = Object.entries(en.serverErrors).map(([key, template]) => {
  const names: string[] = [];
  const source = template
    .split(/(\{\w+\})/)
    .map((part) => {
      const name = part.match(/^\{(\w+)\}$/)?.[1];
      if (!name) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      names.push(name);
      return "(.+?)";
    })
    .join("");
  return { key: key as ErrorKey, regex: new RegExp(`^${source}$`, "s"), names };
});

export async function translateError(message: string, locale?: Locale): Promise<string> {
  const lang = locale ?? (await currentLocale());
  if (lang === "en") return message;
  for (const { key, regex, names } of ERROR_PATTERNS) {
    const match = message.match(regex);
    if (!match) continue;
    const values = Object.fromEntries(names.map((name, i) => [name, match[i + 1]]));
    const t = createTranslator({ locale: lang, messages: await messagesFor(lang), namespace: "serverErrors" });
    return t(key, values);
  }
  return message;
}

// A calendar subscription's stored refresh error (written in English when it
// happened), in the request's language
export async function withLocalError<T extends { lastError: string | null }>(sub: T): Promise<T> {
  return sub.lastError ? { ...sub, lastError: await translateError(sub.lastError) } : sub;
}
