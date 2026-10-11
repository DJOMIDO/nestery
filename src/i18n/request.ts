// src/i18n/request.ts
// next-intl's per-request setup: which language this request is in, and its
// messages. URLs carry no language; it comes from the cookie (the user's
// saved choice), else the browser's Accept-Language, else English.

import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, matchLocale, parseAcceptLanguage } from "@/i18n/config";

export async function requestLocale() {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  const accepted = parseAcceptLanguage((await headers()).get("accept-language"));
  return accepted.length ? matchLocale(accepted) : DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await requestLocale();
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
