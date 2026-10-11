// src/app/api/assistant/models/route.ts

import { NextResponse } from "next/server";
import { ProviderError } from "@/server/assistant/providers/types";
import { listModels, listModelsInput } from "@/server/assistant/settings";
import { errorResponse, getSessionUser, parseInput, unauthorized } from "@/server/session";

// POST /api/assistant/models: the models a key can use (a POST so the key
// stays out of URLs and logs). Without a key, the saved one is used.
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const input = await parseInput(listModelsInput, await request.json().catch(() => null));
  if ("response" in input) return input.response;

  try {
    return NextResponse.json(await listModels(user, input.data));
  } catch (err) {
    if (err instanceof ProviderError) return await errorResponse(err.message, err.status);
    throw err;
  }
}
