// src/lib/meetingLinks.ts
// Finds the link to open for an event in its notes or location, e.g. the
// Teams/Zoom/Meet join link that calendar invites (ICS) put in the description.

import type { CalendarEvent } from "@/lib/calendar";

export interface EventLink {
  url: string;
  // "Teams", "Zoom"…, or the host name for a link that is not a known meeting
  label: string;
  meeting: boolean;
}

const hostIs = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

// Join links by platform; the help and settings links invites also carry
// (e.g. Teams' meetingOptions) do not match
const PLATFORMS: { name: string; matches: (url: URL) => boolean }[] = [
  {
    name: "Teams",
    matches: (u) =>
      (u.hostname === "teams.microsoft.com" || u.hostname === "teams.live.com") &&
      /^\/(meet|l\/meetup-join)\//.test(u.pathname),
  },
  { name: "Zoom", matches: (u) => hostIs(u.hostname, "zoom.us") && /^\/(j|my|w|s)\//.test(u.pathname) },
  { name: "Google Meet", matches: (u) => u.hostname === "meet.google.com" && u.pathname.length > 1 },
  { name: "Webex", matches: (u) => hostIs(u.hostname, "webex.com") },
  { name: "Tencent Meeting", matches: (u) => u.hostname === "meeting.tencent.com" || hostIs(u.hostname, "voovmeeting.com") },
  { name: "Feishu", matches: (u) => u.hostname === "vc.feishu.cn" || u.hostname === "vc.larksuite.com" },
  { name: "GoTo Meeting", matches: (u) => u.hostname === "meet.goto.com" || hostIs(u.hostname, "gotomeeting.com") },
  { name: "Jitsi", matches: (u) => u.hostname === "meet.jit.si" },
  { name: "Whereby", matches: (u) => hostIs(u.hostname, "whereby.com") },
  { name: "Skype", matches: (u) => u.hostname === "join.skype.com" },
];

// Links that come with invites but are never the one to open
const isBoilerplate = (u: URL) =>
  u.hostname === "aka.ms" ||
  (u.hostname === "teams.microsoft.com" && /meetingoptions/i.test(u.pathname)) ||
  hostIs(u.hostname, "support.google.com") ||
  hostIs(u.hostname, "support.zoom.us") ||
  hostIs(u.hostname, "support.microsoft.com");

// http(s) URLs in plain text. Stops at whitespace and the <> quotes Outlook
// wraps links in, then drops trailing punctuation from the sentence.
const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;

function urlsIn(text: string) {
  const urls: URL[] = [];
  for (const match of text.matchAll(URL_PATTERN)) {
    try {
      urls.push(new URL(match[0].replace(/[.,;:!?)\]}]+$/, "")));
    } catch {
      // Not a valid URL after all
    }
  }
  return urls;
}

// The meeting's join link when there is one, otherwise the first other link
export function eventLink(event: CalendarEvent): EventLink | null {
  const urls = urlsIn([event.source?.location, event.notes].filter(Boolean).join("\n"));
  for (const url of urls) {
    const platform = PLATFORMS.find((p) => p.matches(url));
    if (platform) return { url: url.href, label: platform.name, meeting: true };
  }
  const other = urls.find((url) => !isBoilerplate(url));
  return other ? { url: other.href, label: other.hostname.replace(/^www\./, ""), meeting: false } : null;
}
