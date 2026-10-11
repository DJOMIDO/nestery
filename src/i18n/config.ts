// src/i18n/config.ts
// The interface languages and how one is chosen. Shared by the server and
// the browser, so keep it free of server-only imports.

export const LOCALES = ["en", "zh-CN", "zh-TW", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

// Each language in its own words, for the language picker
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  fr: "Français",
};

// Mirrors the user's saved language (or holds a signed-out visitor's choice),
// so each request knows the language without reading the database
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);

// The best language for a browser's preferred languages (most preferred
// first), e.g. ["zh-HK", "en"] → "zh-TW"; English when none match
export function matchLocale(languages: readonly string[]): Locale {
  for (const tag of languages) {
    const lower = tag.toLowerCase();
    if (lower.startsWith("zh")) {
      // Traditional script, or a region that writes it
      return /hant|-tw|-hk|-mo/.test(lower) ? "zh-TW" : "zh-CN";
    }
    if (lower.startsWith("fr")) return "fr";
    if (lower.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}

// The languages in an Accept-Language header, most preferred first
export function parseAcceptLanguage(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag, q: q ? Number(q) : 1 };
    })
    .filter(({ tag, q }) => tag && tag !== "*" && q > 0)
    .sort((a, b) => b.q - a.q)
    .map(({ tag }) => tag);
}
