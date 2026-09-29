// src/app/api/holidays/regions/route.ts

import { NextResponse } from "next/server";
import { HOLIDAY_REGIONS } from "@/server/holidays";

// Codes of the countries and regions that have holiday data
export async function GET() {
  return NextResponse.json(HOLIDAY_REGIONS, {
    headers: { "Cache-Control": "public, max-age=86400" },
  });
}
