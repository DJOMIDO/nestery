// src/app/api/calendar/feed/[token]/route.ts
// The user's calendar for other apps (phone, desktop). No session: the long
// random token in the URL is the credential, and can be replaced or revoked
// in Settings.

import { buildFeed } from "@/server/icsExport";
import { feedOwner } from "@/server/settings";

type Context = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Context) {
  // Calendar apps like URLs ending in .ics
  const { token } = await params;
  const owner = await feedOwner(token.replace(/\.ics$/, ""));
  if (!owner) return new Response("Not found", { status: 404 });

  const ics = await buildFeed(owner.userId, owner.timeZone ?? "UTC");
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="nestery.ics"',
      // Personal data: never stored by shared caches
      "Cache-Control": "private, max-age=300",
    },
  });
}
