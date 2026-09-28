// src/app/api/settings/route.ts

import { NextResponse } from "next/server";
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

  return NextResponse.json(await updateSettings(userId, input.data));
}
