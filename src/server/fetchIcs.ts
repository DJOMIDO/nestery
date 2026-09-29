// src/server/fetchIcs.ts
// Fetches a calendar feed from a user-supplied URL. Because the server makes
// the request, the URL is treated as untrusted: only public http(s) hosts are
// allowed (no localhost, private networks or cloud metadata addresses), every
// redirect is checked again, and time and size are capped.

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;

export class FeedError extends Error {}

// webcal:// is how many calendar apps share feeds; it is plain HTTP(S) underneath
export function normalizeFeedUrl(input: string) {
  const trimmed = input.trim().replace(/^webcals?:\/\//i, "https://");
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new FeedError("That doesn't look like a link");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new FeedError("Only http, https and webcal links are supported");
  }
  if (url.username || url.password) throw new FeedError("Links with a username or password are not supported");
  return url;
}

function ipv4Blocked(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || // "this" network
    a === 10 || // private
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, incl. cloud metadata (169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) || // private
    (a === 192 && b === 168) || // private
    (a === 192 && b === 0) || // IETF protocol assignments
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast and reserved
  );
}

// Eight 16-bit groups of an IPv6 address (handles "::" and a trailing dotted IPv4)
function ipv6Groups(ip: string) {
  let text = ip.toLowerCase().split("%")[0];
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (dotted) {
    const [a, b, c, d] = dotted[1].split(".").map(Number);
    text = text.slice(0, -dotted[1].length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = text.split("::");
  const parse = (part?: string) => (part ? part.split(":").map((g) => parseInt(g, 16)) : []);
  const front = parse(head);
  const back = tail === undefined ? [] : parse(tail);
  const zeros = tail === undefined ? 0 : 8 - front.length - back.length;
  return [...front, ...Array(zeros).fill(0), ...back];
}

function ipBlocked(ip: string) {
  if (isIP(ip) === 4) return ipv4Blocked(ip);
  const g = ipv6Groups(ip);
  if (g.length !== 8 || g.some((n) => Number.isNaN(n))) return true;
  const embeddedV4 = () => `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  const leadingZeros = g.slice(0, 5).every((n) => n === 0);
  // IPv4-mapped (::ffff:a.b.c.d), IPv4-compatible (::a.b.c.d) and NAT64 (64:ff9b::a.b.c.d)
  if ((leadingZeros && (g[5] === 0xffff || g[5] === 0)) || (g[0] === 0x64 && g[1] === 0xff9b)) {
    if (g.slice(0, 7).every((n) => n === 0) && g[7] <= 1) return true; // :: and ::1
    return ipv4Blocked(embeddedV4());
  }
  return (
    (g[0] & 0xfe00) === 0xfc00 || // unique local fc00::/7
    (g[0] & 0xffc0) === 0xfe80 || // link-local fe80::/10
    (g[0] & 0xff00) === 0xff00 // multicast
  );
}

async function assertPublicHost(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new FeedError("That address is not reachable from Nestery");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => {
    throw new FeedError("Could not find that server");
  });
  if (addresses.length === 0 || addresses.some(({ address }) => ipBlocked(address))) {
    throw new FeedError("That address is not reachable from Nestery");
  }
}

// Reads the body as text, giving up past MAX_BYTES
async function readCapped(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new FeedError("The calendar is too large (over 5 MB)");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

// Returns the feed's text; throws FeedError with a message fit to show the user
export async function fetchIcs(input: string) {
  let url = normalizeFeedUrl(input);
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  for (let hop = 0; ; hop++) {
    await assertPublicHost(url);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal,
        headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.1", "User-Agent": "Nestery calendar" },
      });
    } catch (err) {
      throw new FeedError(
        (err as Error).name === "TimeoutError" ? "The calendar took too long to respond" : "Could not reach the calendar"
      );
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location || hop >= MAX_REDIRECTS) throw new FeedError("The calendar link redirects too many times");
      // Each hop is checked again, so a public link cannot redirect inward
      url = normalizeFeedUrl(new URL(location, url).toString());
      continue;
    }
    if (!res.ok) throw new FeedError(`The calendar server answered ${res.status}`);

    const text = await readCapped(res);
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new FeedError("That link is not an iCalendar (.ics) feed");
    return text;
  }
}
