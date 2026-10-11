// src/app/api/settings/route.ts

import { NextResponse } from "next/server";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from "@/i18n/config";
import { getSettings, updateSettings, updateSettingsInput } from "@/server/settings";
import { getUserId, parseInput, unauthorized } from "@/server/session";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  return NextResponse.json(await getSettings(userId));
}

export async function PATCH(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const input = await parseInput(
    updateSettingsInput,
    await request.json().catch(() => null)
  );
  if ("response" in input) return input.response;

  const response = NextResponse.json(await updateSettings(userId, input.data));
  // Requests read the language from this cookie (src/i18n/request.ts); no
  // saved language lets the browser's own languages decide again
  if ("language" in input.data) {
    if (input.data.language) {
      response.cookies.set(LOCALE_COOKIE, input.data.language, {
        path: "/",
        maxAge: LOCALE_COOKIE_MAX_AGE,
        sameSite: "lax",
      });
    } else {
      response.cookies.delete(LOCALE_COOKIE);
    }
  }
  return response;
}
