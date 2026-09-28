// src/lib/recurrence.ts
// Repeating events: the subset of RFC 5545 RRULEs Nestery creates, and
// expansion of a series into occurrence dates. Works on local calendar dates
// (YYYY-MM-DD); times are re-attached by the caller, by the wall clock.

export type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

export interface RecurrenceRule {
  freq: Frequency;
  // Every `interval` days/weeks/months/years
  interval: number;
  // WEEKLY only: weekdays, 0 = Sunday … 6 = Saturday
  byDay?: number[];
  // Stop after this many occurrences (deleted ones still count), or…
  count?: number;
  // …on this day, inclusive (YYYY-MM-DD)
  until?: string;
}

const WEEKDAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const FREQUENCIES: Frequency[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

// Parses what formatRRule writes; anything else (BYSETPOS, BYMONTHDAY, …) is
// rejected rather than half understood
export function parseRRule(value: string): RecurrenceRule | null {
  const parts = new Map<string, string>();
  for (const part of value.replace(/^RRULE:/i, "").split(";")) {
    const [key, val] = part.split("=");
    if (!key || val === undefined) return null;
    parts.set(key.toUpperCase(), val.toUpperCase());
  }
  const freq = parts.get("FREQ") as Frequency | undefined;
  if (!freq || !FREQUENCIES.includes(freq)) return null;

  const rule: RecurrenceRule = { freq, interval: 1 };
  for (const [key, val] of parts) {
    if (key === "FREQ") continue;
    if (key === "INTERVAL") {
      rule.interval = Number(val);
      if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 999) return null;
    } else if (key === "COUNT") {
      rule.count = Number(val);
      if (!Number.isInteger(rule.count) || rule.count < 1 || rule.count > 999) return null;
    } else if (key === "UNTIL") {
      // Date (20261231) or date-time (20261231T235959Z); only the day is kept
      const m = /^(\d{4})(\d{2})(\d{2})(T\d{6}Z?)?$/.exec(val);
      if (!m) return null;
      rule.until = `${m[1]}-${m[2]}-${m[3]}`;
    } else if (key === "BYDAY" && freq === "WEEKLY") {
      const days = val.split(",").map((code) => WEEKDAY_CODES.indexOf(code));
      if (days.some((d) => d < 0)) return null;
      rule.byDay = [...new Set(days)].sort((a, b) => a - b);
    } else if (key === "WKST") {
      continue;
    } else {
      return null;
    }
  }
  if (rule.count && rule.until) return null;
  return rule;
}

export function formatRRule(rule: RecurrenceRule) {
  const parts = [`FREQ=${rule.freq}`];
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.freq === "WEEKLY" && rule.byDay?.length) {
    parts.push(`BYDAY=${rule.byDay.map((d) => WEEKDAY_CODES[d]).join(",")}`);
  }
  if (rule.count) parts.push(`COUNT=${rule.count}`);
  if (rule.until) parts.push(`UNTIL=${rule.until.replaceAll("-", "")}`);
  return parts.join(";");
}

// ---- Date arithmetic on YYYY-MM-DD, independent of time zones -------------

const parse = (d: string) => [+d.slice(0, 4), +d.slice(5, 7), +d.slice(8, 10)] as const;
const key = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const utcDay = (d: string) => {
  const [y, m, day] = parse(d);
  return Date.UTC(y, m - 1, day) / 86_400_000;
};
const fromUtcDay = (n: number) => {
  const date = new Date(n * 86_400_000);
  return key(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
};
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const weekday = (d: string) => new Date(utcDay(d) * 86_400_000).getUTCDay();

// Safety net against runaway loops (about 27 years of daily events)
const MAX_STEPS = 10_000;

// Start dates of the occurrences of a series beginning on `start`, from `from`
// to `to` (inclusive). Dates in `exdates` are left out but still count
// towards COUNT, as in RFC 5545.
export function occurrenceDates(
  start: string,
  rule: RecurrenceRule,
  from: string,
  to: string,
  exdates: readonly string[] = []
) {
  const last = rule.until && rule.until < to ? rule.until : to;
  const skipped = new Set(exdates);
  const dates: string[] = [];
  let produced = 0;

  // Returns false once the series is over
  const emit = (date: string) => {
    if (date > last) return false;
    if (rule.count && produced >= rule.count) return false;
    produced++;
    if (date >= from && !skipped.has(date)) dates.push(date);
    return true;
  };

  const [sy, sm, sd] = parse(start);
  // Without COUNT nothing before `from` matters, so long-running series jump
  // close to the range instead of walking from their first occurrence
  let firstStep = 0;
  if (!rule.count && from > start) {
    const [fy, fm] = parse(from);
    const periods =
      rule.freq === "DAILY"
        ? (utcDay(from) - utcDay(start)) / rule.interval
        : rule.freq === "WEEKLY"
          ? (utcDay(from) - utcDay(start)) / (7 * rule.interval)
          : ((fy - sy) * 12 + (fm - sm)) / (rule.freq === "MONTHLY" ? rule.interval : 12 * rule.interval);
    firstStep = Math.max(0, Math.floor(periods) - 1);
  }
  for (let step = firstStep; step < firstStep + MAX_STEPS; step++) {
    if (rule.freq === "DAILY") {
      if (!emit(fromUtcDay(utcDay(start) + step * rule.interval))) break;
    } else if (rule.freq === "WEEKLY") {
      // Weeks run Monday to Sunday (RFC 5545's default WKST)
      const weekStart = utcDay(start) - ((weekday(start) + 6) % 7) + step * 7 * rule.interval;
      const days = rule.byDay?.length ? rule.byDay : [weekday(start)];
      let done = false;
      // Monday first, Sunday last
      for (const d of [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))) {
        const date = fromUtcDay(weekStart + ((d + 6) % 7));
        if (date < start) continue;
        if (!emit(date)) {
          done = true;
          break;
        }
      }
      if (done) break;
    } else {
      const months = rule.freq === "MONTHLY" ? step * rule.interval : step * rule.interval * 12;
      const y = sy + Math.floor((sm - 1 + months) / 12);
      const m = ((sm - 1 + months) % 12) + 1;
      if (key(y, m, 1) > last) break;
      // A month without this day (31st, 29 February) has no occurrence
      if (sd <= daysInMonth(y, m) && !emit(key(y, m, sd))) break;
    }
  }
  return dates;
}

// A short description, e.g. "Every 2 weeks on Mon, Wed, until Dec 31, 2026"
export function describeRule(
  rule: RecurrenceRule,
  { weekdayName, formatDay }: { weekdayName: (day: number) => string; formatDay: (d: string) => string }
) {
  const unit = { DAILY: "day", WEEKLY: "week", MONTHLY: "month", YEARLY: "year" }[rule.freq];
  let text = rule.interval === 1 ? `Every ${unit}` : `Every ${rule.interval} ${unit}s`;
  if (rule.freq === "DAILY" && rule.interval === 1) text = "Daily";
  if (rule.freq === "WEEKLY" && rule.byDay?.length) {
    text += ` on ${[...rule.byDay].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(weekdayName).join(", ")}`;
  }
  if (rule.count) text += `, ${rule.count} times`;
  if (rule.until) text += `, until ${formatDay(rule.until)}`;
  return text;
}

// Shortest time between two starts of the series, in days. A weekly rule on
// Mon and Wed has occurrences 2 days apart; months are counted as 28 days.
export function shortestGapDays(rule: RecurrenceRule) {
  switch (rule.freq) {
    case "DAILY":
      return rule.interval;
    case "MONTHLY":
      return 28 * rule.interval;
    case "YEARLY":
      return 365 * rule.interval;
    case "WEEKLY": {
      // Positions in a Monday-first week
      const days = [...new Set(rule.byDay?.length ? rule.byDay : [1])]
        .map((d) => (d + 6) % 7)
        .sort((a, b) => a - b);
      const gaps = days.slice(1).map((d, i) => d - days[i]);
      // From the last chosen day to the first one in the next repeating week
      gaps.push(7 * rule.interval - (days[days.length - 1] - days[0]));
      return Math.min(...gaps);
    }
  }
}

// Occurrences may touch but not overlap, so an event must not last longer
// than the gap between two starts (as in Google Calendar). `days` is how many
// calendar days an all-day event covers; `ms` is a timed event's duration.
export function durationFitsRule(rule: RecurrenceRule, length: { days: number } | { ms: number }) {
  const gap = shortestGapDays(rule);
  return "days" in length ? length.days <= gap : length.ms <= gap * 86_400_000;
}
