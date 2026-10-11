// src/server/session.ts

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { auth } from "@/lib/auth";
import { translateError } from "@/server/i18n";

// Returns the signed-in user's id, or null when there is no valid session.
export async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

// The signed-in user's id and email, or null
export async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? { id: session.user.id, email: session.user.email } : null;
}

export const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export const notFound = () =>
  NextResponse.json({ error: "Not found" }, { status: 404 });

// Parses a JSON body (or other input) with a zod schema. On failure, returns a
// 400 response carrying the first validation message.
// A JSON error response, its message in the request's language
export async function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: await translateError(message) }, { status });
}

export async function parseInput<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown
): Promise<{ data: z.infer<T> } | { response: NextResponse }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      response: await errorResponse(parsed.error.issues[0]?.message ?? "Invalid request", 400),
    };
  }
  return { data: parsed.data };
}
