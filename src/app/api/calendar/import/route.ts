// src/app/api/calendar/import/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import { ImportError, importIcs, previewImport } from "@/server/icsImport";
import { getUserId, parseInput, unauthorized } from "@/server/session";
import { isTimeZone } from "@/server/timeZones";

const importInput = z.object({
  ics: z
    .string()
    .max(5 * 1024 * 1024, "The file is too large (over 5 MB)")
    .refine((text) => /BEGIN:VCALENDAR/i.test(text), "That file is not an iCalendar (.ics) file"),
  // The browser's zone, for events without one (floating times)
  timeZone: z.string().max(64).refine(isTimeZone, "Unknown time zone"),
  unsupported: z.enum(["first", "skip"]).default("first"),
  // true: only report what would be imported
  dryRun: z.boolean().default(false),
});

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const input = await parseInput(importInput, await request.json().catch(() => null));
  if ("response" in input) return input.response;
  const { ics, timeZone, unsupported, dryRun } = input.data;

  try {
    if (dryRun) return NextResponse.json({ summary: await previewImport(userId, ics, timeZone, unsupported) });
    return NextResponse.json(await importIcs(userId, ics, timeZone, unsupported));
  } catch (err) {
    // Problems with the file are the user's to fix; anything else is a real error
    if (err instanceof ImportError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
