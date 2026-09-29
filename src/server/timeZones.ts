// src/server/timeZones.ts
// Wall-clock time in an IANA time zone <-> instants, without depending on the
// server's own zone (UTC on Vercel).

export interface WallTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function isTimeZone(zone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

// The wall-clock time an instant shows in a zone
export function wallTimeIn(date: Date, timeZone: string): WallTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

// YYYY-MM-DD of an instant in a zone
export function dateKeyIn(date: Date, timeZone: string) {
  const t = wallTimeIn(date, timeZone);
  return `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
}

// The instant a wall-clock time names in a zone. Around DST changes a time can
// be skipped or repeated; this settles on the zone's offset at that moment.
export function wallTimeToDate(t: WallTime, timeZone: string) {
  const asUtc = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
  try {
    // Offset of the zone near that moment: how far its clock is from UTC
    const offsetAt = (ms: number) => {
      const shown = wallTimeIn(new Date(ms), timeZone);
      return Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second) - ms;
    };
    const first = asUtc - offsetAt(asUtc);
    // A second pass settles cases where the first guess crossed a DST change
    return new Date(asUtc - offsetAt(first));
  } catch {
    return new Date(asUtc); // unknown zone name: treat as UTC
  }
}
