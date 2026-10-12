// src/lib/eventContacts.ts
// Addresses, phone numbers and email addresses in an event's text (its notes,
// a subscribed event's location), so the details can offer a map, a call or
// an email, and the notes can link them. Plain heuristics, tuned to miss
// rather than to mistake dates, times or order numbers for phones.

export interface Contact {
  text: string;
  href: string;
}

export interface Contacts {
  addresses: string[];
  phones: Contact[];
  emails: Contact[];
}

// A run of notes text, linked when it is a URL, an email or a phone
export interface NoteSegment {
  text: string;
  href?: string;
}

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// Digits with the usual separators, optionally international
const PHONE_PATTERN = /(?:\+|\b00)?\(?\d[\d\s().-]{5,}\d/g;
// Words that say a number on the line is a phone
const PHONE_LABEL = /(tel|phone|mobile|cell|téléphone|tél|portable|电话|電話|手机|手機|联系|聯絡|聯繫)/i;

// Words that say it isn't one: meeting IDs, passcodes, bookings, orders
const NOT_PHONE_LABEL =
  /(\bID|passcode|password|code|ref|reference|order|booking|confirmation|PNR|réservation|commande|会议号|會議號|密码|密碼|订单|訂單|预订|預訂|编号|編號)\s*[:#：号號]?\s*$/i;

// Sentence punctuation stuck to the end of a link
const trimEnd = (text: string) => text.replace(/[.,;:!?)\]}。，；：！？）]+$/, "");

// `before`: the text just before the number on its line, where a label
// ("电话：", "Tel") would be
function looksLikePhone(raw: string, before: string) {
  const text = raw.trim();
  const digits = text.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  // Dates (2026-10-12, 12/10/2026) and year ranges (2025-2026)
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$|^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$|^\d{4}\s*[-–]\s*\d{4}$/.test(text)) return false;
  if (NOT_PHONE_LABEL.test(before)) return false;
  if (PHONE_LABEL.test(before)) return true;
  // Bare digits are order numbers and the like, except a Chinese mobile
  if (/^\d+$/.test(text)) return /^1[3-9]\d{9}$/.test(text);
  // International, national (leading 0), or grouped like a phone
  return /^(\+|00|0|\()/.test(text) || digits.length >= 10;
}

const phoneHref = (text: string) => `tel:${text.trim().startsWith("+") ? "+" : ""}${text.replace(/\D/g, "")}`;

// Every link-like match in `text`, in order, without overlaps: URLs first,
// then emails and phones in what is left
function matches(text: string): (NoteSegment & { start: number; end: number })[] {
  const found: (NoteSegment & { start: number; end: number })[] = [];
  let rest = text;
  const take = (start: number, value: string, href: string) => {
    found.push({ start, end: start + value.length, text: value, href });
    rest = rest.slice(0, start) + " ".repeat(value.length) + rest.slice(start + value.length);
  };
  for (const m of text.matchAll(URL_PATTERN)) take(m.index!, trimEnd(m[0]), trimEnd(m[0]));
  for (const m of [...rest.matchAll(EMAIL_PATTERN)]) take(m.index!, m[0], `mailto:${m[0]}`);
  for (const m of [...rest.matchAll(PHONE_PATTERN)]) {
    const value = m[0].replace(/[\s(.-]+$/, "").replace(/^[\s.-]+/, "");
    const start = m.index! + m[0].indexOf(value);
    const lineStart = text.lastIndexOf("\n", start) + 1;
    const before = text.slice(Math.max(lineStart, start - 15), start);
    if (looksLikePhone(value, before)) take(start, value, phoneHref(value));
  }
  return found.sort((a, b) => a.start - b.start);
}

export function linkify(text: string): NoteSegment[] {
  const segments: NoteSegment[] = [];
  let at = 0;
  for (const m of matches(text)) {
    if (m.start > at) segments.push({ text: text.slice(at, m.start) });
    segments.push({ text: m.text, href: m.href });
    at = m.end;
  }
  if (at < text.length) segments.push({ text: text.slice(at) });
  return segments;
}

// ---- Addresses ----------------------------------------------------------------

const ADDRESS_LABEL = /^\s*(?:地址|地點|地点|位置|address|location|venue|where|adresse|lieu)\s*[:：]\s*(.+)$/i;
// "12 rue de Rivoli", "221B Baker Street", "Hauptstraße 5"
const STREET =
  /(\b\d{1,5}[a-z]?,?\s+(?:rue|avenue|av\.|boulevard|bd|place|chemin|allée|impasse|quai|cours|street|st\.?|road|rd\.?|lane|ln\.?|drive|dr\.?|way|court|square|via|calle|carrer)\s+(?=\p{L}))|(\p{L}+(?:straße|strasse|str\.|weg|platz|gasse)\s+\d{1,4})|(\b\d{1,5}[a-z]?\s+\p{Lu}[\p{L}'-]+\s+(?:street|st\.?|road|rd\.?|avenue|ave\.?|lane|drive|way|court|square|boulevard|blvd|parkway|pkwy|highway|hwy|terrace|crescent|place|plaza)\b)/iu;
// "75004 Paris", "10115 Berlin"
const POSTCODE_CITY = /^\s*\d{4,5}\s+\p{Lu}[\p{L}' -]+$/u;
// Chinese: an area (省/市/区…) and a place in it (路/号/大厦…)
const CHINESE_AREA = /[省市区區县縣镇鎮]/;
const CHINESE_PLACE = /[路街道巷弄号號]|大厦|大廈|广场|廣場|中心|大楼|大樓/;

export function addressesIn(text: string): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const found: string[] = [];
  lines.forEach((line, i) => {
    if (!line || line.length > 120 || /https?:\/\//i.test(line) || EMAIL_PATTERN.test(line)) return;
    EMAIL_PATTERN.lastIndex = 0;
    // An address ends with its sentence ("…6 层。请提前到达。", "…Berlin. Order…")
    const firstSentence = (text: string) => trimEnd(text.split(/[。；]|(?<=[^\d\s])[.;]\s/)[0]);
    const labelled = line.match(ADDRESS_LABEL)?.[1];
    if (labelled) return found.push(firstSentence(labelled));
    // Found by its look: without a short label in front ("Hotel: ")
    const sentence = firstSentence(line.replace(/^[\p{L} ]{1,20}[:：]\s*/u, ""));
    if (CHINESE_AREA.test(line) && CHINESE_PLACE.test(line) && /\d|号|號/.test(line) && line.length >= 6) {
      return found.push(sentence);
    }
    if (STREET.test(line)) {
      // The postcode and town often follow on the next line
      const next = lines[i + 1];
      found.push(next && POSTCODE_CITY.test(next) ? `${sentence}, ${next}` : sentence);
    }
  });
  return [...new Set(found)];
}

export function contactsIn(text: string): Contacts {
  const found = matches(text);
  const unique = (items: Contact[]) => [...new Map(items.map((c) => [c.href, c])).values()];
  return {
    addresses: addressesIn(text),
    phones: unique(found.filter((m) => m.href?.startsWith("tel:")).map(({ text, href }) => ({ text, href: href! }))),
    emails: unique(found.filter((m) => m.href?.startsWith("mailto:")).map(({ text, href }) => ({ text, href: href! }))),
  };
}

// A search for the address in the device's maps: Apple Maps on Apple
// devices, Google Maps elsewhere
export const mapsUrl = (address: string, apple: boolean) =>
  apple
    ? `https://maps.apple.com/?q=${encodeURIComponent(address)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
