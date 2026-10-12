// src/app/api/travel/airlines/route.ts

import { NextResponse } from "next/server";
import { getUserId, unauthorized } from "@/server/session";
import { isLocale } from "@/i18n/config";
import { currentLocale } from "@/server/i18n";
import { searchAirlines } from "@/server/travel";

// GET /api/travel/airlines?q=…&lang=…: suggestions for the journey form,
// named in the interface's language (in the URL, so cached answers stay
// apart per language)
export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").slice(0, 100);
  const lang = params.get("lang");
  const results = searchAirlines(q, isLocale(lang) ? lang : await currentLocale());
  return NextResponse.json(results, { headers: { "Cache-Control": "private, max-age=3600" } });
}
