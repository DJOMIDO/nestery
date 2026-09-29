// src/app/api/holidays/route.ts
// Public holidays, computed on the server. Not user data, so no session is
// needed and responses can be cached.

import { NextResponse } from "next/server";
import { z } from "zod";
import { publicHolidays } from "@/server/holidays";
import { parseInput } from "@/server/session";

const holidaysInput = z.object({
  // "FR,TW"
  countries: z
    .string()
    .regex(/^([A-Z]{2}(,[A-Z]{2}){0,4})?$/, "Use up to 5 two-letter codes")
    .transform((v) => (v ? v.split(",") : [])),
  // "2026,2027"
  years: z
    .string()
    .regex(/^\d{4}(,\d{4}){0,2}$/, "Use up to 3 years")
    .transform((v) => v.split(",").map(Number)),
});

// GET /api/holidays?countries=FR,TW&years=2026,2027
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const input = await parseInput(holidaysInput, params);
  if ("response" in input) return input.response;

  return NextResponse.json(publicHolidays(input.data.countries, input.data.years), {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
