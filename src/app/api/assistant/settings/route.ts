// src/app/api/assistant/settings/route.ts

import { NextResponse } from "next/server";
import { ProviderError } from "@/server/assistant/providers/types";
import {
  deleteAssistantSettings,
  getAssistantSettings,
  saveAssistantSettings,
  saveAssistantSettingsInput,
} from "@/server/assistant/settings";
import { getSessionUser, parseInput, unauthorized } from "@/server/session";

// GET /api/assistant/settings: provider and model, never the key itself
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  return NextResponse.json(await getAssistantSettings(user.id));
}

// PUT /api/assistant/settings: checks the key and model before saving
export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const input = await parseInput(saveAssistantSettingsInput, await request.json().catch(() => null));
  if ("response" in input) return input.response;

  try {
    return NextResponse.json(await saveAssistantSettings(user, input.data));
  } catch (err) {
    if (err instanceof ProviderError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

// DELETE /api/assistant/settings: forgets the provider, model and key
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  await deleteAssistantSettings(user.id);
  return new Response(null, { status: 204 });
}
