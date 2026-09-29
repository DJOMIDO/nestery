// src/app/api/account/providers/route.ts

import { NextResponse } from "next/server";
import { socialProviderIds } from "@/lib/auth";

// Configured social sign-in providers, for Settings > Account (client side)
export async function GET() {
  return NextResponse.json(socialProviderIds);
}
