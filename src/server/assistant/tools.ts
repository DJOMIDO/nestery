// src/server/assistant/tools.ts
// What the assistant can do. Read tools query the user's own data; write
// tools only *propose* a change, which the user confirms in the panel before
// anything is saved. The user id always comes from the session, never from
// the model.

import { randomUUID } from "node:crypto";
import * as z from "zod/v4";
import type { AssistantProposal } from "@/lib/assistant";
import { expandEvents, type CalendarEvent } from "@/lib/calendar";
import { addDays, compareTasks, TASK_PRIORITIES, TASK_STATUSES, type Task } from "@/lib/tasks";
import type { Formatter } from "@/lib/format";
import { noteHref } from "@/lib/notes";
import { MAX_SPLIT_PARTS, noteText, splitNoteContent, type NoteSplitRule } from "@/lib/noteSplit";
import { DEFAULT_REMIND_BEFORE } from "@/lib/travel";
import type { WeatherPlace } from "@/lib/weather";
import { createEventInput, listEvents } from "@/server/events";
import { getNote, listNotes, searchNotes } from "@/server/notes";
import { subscriptionEvents } from "@/server/subscriptions";
import { createTaskInput, getTask, listTasks, updateTaskInput } from "@/server/tasks";
import { journeyInput, listJourneys } from "@/server/travel";
import { dailyForecast, searchPlaces } from "@/server/weather";
import type { ToolSpec } from "@/server/assistant/providers/types";

export interface ToolContext {
  userId: string;
  timeZone: string;
  today: string;
  // From Settings > Weather
  place: WeatherPlace | null;
  // Writes dates the way the app shows them to this user
  format: Formatter;
  propose: (proposal: AssistantProposal) => void;
}

interface Tool<S extends z.ZodType> {
  name: string;
  description: string;
  // Shown in the panel while the tool runs
  label: string;
  input: S;
  run: (input: z.infer<S>, ctx: ToolContext) => Promise<unknown>;
}

const tool = <S extends z.ZodType>(t: Tool<S>) => t;

// A result the model should read as a failure it can correct
class ToolError extends Error {}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use YYYY-MM-DDTHH:mm");

const clip = (text: string | null | undefined, max: number) =>
  !text ? undefined : text.length > max ? `${text.slice(0, max)}…` : text;

// ---- Time zones ------------------------------------------------------------

function zoned(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export const todayIn = (timeZone: string) => zoned(new Date(), timeZone).date;

// "2026-10-16T09:30" on the wall clock of `timeZone` -> an ISO timestamp
function wallClockToIso(local: string, timeZone: string) {
  const asUtc = Date.parse(`${local}:00Z`);
  const offset = (instant: number) => {
    const p = zoned(new Date(instant), timeZone);
    return Date.parse(`${p.date}T${p.time}:00Z`) - instant;
  };
  // Twice, in case the first guess lands on the other side of a DST change
  const first = asUtc - offset(asUtc);
  return new Date(asUtc - offset(first)).toISOString();
}

// "Mon, Oct 12, 9:00 AM – 10:00 AM" in the user's format; times are the
// user's wall clock ("HH:mm"), turned into a Date only to be formatted
function describeWhen(
  allDay: boolean,
  start: { date: string; time: string },
  end: { date: string; time: string },
  format: Formatter
) {
  const time = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return format.time(new Date(2000, 0, 1, h, m));
  };
  if (allDay) {
    return end.date === start.date
      ? `${format.dayWithWeekday(start.date)} (all day)`
      : `${format.dayWithWeekday(start.date)} – ${format.dayWithWeekday(end.date)} (all day)`;
  }
  return end.date === start.date
    ? `${format.dayWithWeekday(start.date)}, ${time(start.time)} – ${time(end.time)}`
    : `${format.dayWithWeekday(start.date)}, ${time(start.time)} – ${format.dayWithWeekday(end.date)}, ${time(end.time)}`;
}

// ---- Tools -----------------------------------------------------------------

const listTasksTool = tool({
  name: "list_tasks",
  label: "Checking your tasks",
  description:
    "List the user's tasks, most urgent first. Open tasks are those not done (to do, in progress or waiting). Use the filters to narrow down; dates are YYYY-MM-DD in the user's time zone.",
  input: z.object({
    status: z
      .enum(["open", ...TASK_STATUSES, "any"])
      .optional()
      .describe('"open" (default) = not done; or one status; or "any"'),
    tag: z.string().optional().describe("Only tasks with this tag"),
    dueFrom: date.optional(),
    dueTo: date.optional(),
    text: z.string().optional().describe("Only tasks whose title or description contains this"),
  }),
  async run({ status = "open", tag, dueFrom, dueTo, text }, { userId, format }) {
    const rows = await listTasks(userId, {
      ...(status !== "open" && status !== "any" && { status }),
      tag,
      dueFrom,
      dueTo,
    });
    const needle = text?.toLowerCase();
    const tasks = (JSON.parse(JSON.stringify(rows)) as Task[])
      .filter((t) => status !== "open" || t.status !== "done")
      .filter((t) => !needle || `${t.title} ${t.description ?? ""}`.toLowerCase().includes(needle))
      .sort(compareTasks);
    return {
      total: tasks.length,
      tasks: tasks.slice(0, 40).map((t) => ({
        id: t.id,
        link: `/tasks?task=${t.id}`,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        dueText: t.dueDate ? format.dayWithWeekday(t.dueDate) : undefined,
        tags: t.tags.length ? t.tags : undefined,
        description: clip(t.description, 200),
      })),
    };
  },
});

const listEventsTool = tool({
  name: "list_events",
  label: "Looking at your calendar",
  description:
    "List calendar events between two dates (inclusive, at most 31 days apart), including repeating events and subscribed calendars such as a class timetable. Times are in the user's time zone.",
  input: z.object({ from: date, to: date }),
  async run({ from, to }, { userId, timeZone, format }) {
    if (to < from) throw new ToolError("`to` is before `from`");
    if (to > addDays(from, 30)) throw new ToolError("Ask for at most 31 days at a time");

    const own = JSON.parse(JSON.stringify(await listEvents(userId, { from, to }))) as CalendarEvent[];
    const subscribed = await subscriptionEvents(userId, { from, to, tz: timeZone });
    const events = [...expandEvents(own, from, to), ...expandEvents(subscribed, from, to)];

    return events
      .map((e) => {
        const start = e.allDay ? { date: e.startDate!, time: "" } : zoned(new Date(e.startsAt!), timeZone);
        const end = e.allDay ? { date: e.endDate!, time: "" } : zoned(new Date(e.endsAt!), timeZone);
        return { e, start, end };
      })
      .filter(({ start, end }) => start.date <= to && end.date >= from)
      .sort((a, b) => `${a.start.date}${a.start.time}`.localeCompare(`${b.start.date}${b.start.time}`))
      .slice(0, 100)
      .map(({ e, start, end }) => ({
        title: e.title,
        link: `/calendar?date=${start.date}`,
        whenText: describeWhen(e.allDay, start, end, format),
        ...(e.allDay
          ? { allDay: true, date: start.date, ...(end.date !== start.date && { until: end.date }) }
          : {
              start: `${start.date} ${start.time}`,
              end: end.date === start.date ? end.time : `${end.date} ${end.time}`,
            }),
        repeating: e.rrule ? true : undefined,
        calendar: e.source?.name,
        location: e.source?.location ?? undefined,
        notes: clip(e.notes, 200),
      }));
  },
});

const listNotesTool = tool({
  name: "list_notes",
  label: "Looking at your notes",
  description:
    "List the user's notes, pinned first, then most recently edited, with the start of each and their tags (shared with tasks). Use it for questions about the notes in general or with a tag; use search_notes to find specific content.",
  input: z.object({
    limit: z.number().int().min(1).max(50).optional().describe("How many notes (default 20)"),
    tag: z.string().optional().describe("Only notes with this tag, without the #"),
  }),
  async run({ limit = 20, tag }, { userId, format }) {
    const wanted = tag?.replace(/^#+/, "").trim().toLowerCase();
    const notes = (await listNotes(userId)).filter((n) => !wanted || n.tags.some((t) => t.toLowerCase() === wanted));
    return {
      total: notes.length,
      notes: notes.slice(0, limit).map((n) => ({
        id: n.id,
        link: noteHref(n.id),
        title: n.title || "Untitled",
        pinned: n.pinned || undefined,
        tags: n.tags.length ? n.tags : undefined,
        updatedText: format.dayWithYear(n.updatedAt),
        start: clip(n.contentText.trim(), 200),
      })),
    };
  },
});

const searchNotesTool = tool({
  name: "search_notes",
  label: "Searching your notes",
  description:
    "Find the user's notes containing all the given words (title, text or tags, any case). Returns excerpts; use read_note for a whole note.",
  input: z.object({
    query: z
      .string()
      .min(1)
      .describe("One or a few keywords separated by spaces, not a sentence. For Chinese, use short words such as “签证”."),
  }),
  async run({ query }, { userId, format }) {
    const notes = await searchNotes(userId, query, 8);
    const first = query.trim().split(/\s+/)[0].toLowerCase();
    return notes.map((n) => {
      const at = Math.max(0, n.contentText.toLowerCase().indexOf(first) - 150);
      return {
        id: n.id,
        link: noteHref(n.id),
        title: n.title || "Untitled",
        tags: n.tags.length ? n.tags : undefined,
        updatedText: format.dayWithYear(n.updatedAt),
        excerpt: clip(n.contentText.slice(at), 500),
      };
    });
  },
});

const readNoteTool = tool({
  name: "read_note",
  label: "Reading a note",
  description: "Read one of the user's notes in full (plain text), by an id from list_notes or search_notes.",
  input: z.object({ id: z.uuid() }),
  async run({ id }, { userId }) {
    const note = await getNote(userId, id);
    if (!note) throw new ToolError("No note with that id");
    return {
      title: note.title || "Untitled",
      link: noteHref(note.id),
      tags: note.tags.length ? note.tags : undefined,
      text: clip(note.contentText, 12_000) ?? "",
    };
  },
});

const weatherTool = tool({
  name: "get_weather",
  label: "Checking the weather",
  description:
    "Daily weather forecast (today first) for a place, up to 14 days ahead. Without a place, uses the place the user chose in Settings.",
  input: z.object({
    place: z.string().optional().describe("City name, optionally with the country, e.g. “Paris, France”"),
    days: z.number().int().min(1).max(14).optional().describe("How many days, today included (default 3)"),
  }),
  async run({ place, days = 3 }, { timeZone, place: saved, format }) {
    let where = saved;
    if (place) {
      // "Paris, France": search the city, prefer matches in that country
      const [city, ...rest] = place.split(",");
      const country = rest.join(",").trim().toLowerCase();
      const matches = await searchPlaces(city.trim());
      where = matches.find((m) => !country || m.detail?.toLowerCase().includes(country)) ?? matches[0] ?? null;
      if (!where) throw new ToolError(`No place called “${place}” was found`);
    }
    if (!where) throw new ToolError("The user has not chosen a place in Settings > Weather; ask which place");
    return {
      place: [where.name, where.detail].filter(Boolean).join(", "),
      // The user's unit (Settings > Weather): say temperatures in it
      temperatureUnit: `°${format.temperatureUnit}`,
      days: (await dailyForecast(where, timeZone, days)).map((d) => ({
        ...d,
        high: format.temperature(d.high),
        low: format.temperature(d.low),
        dateText: format.dayWithWeekday(d.date),
      })),
    };
  },
});

const listJourneysTool = tool({
  name: "list_journeys",
  label: "Checking your trips",
  description:
    "List the user's flights and train journeys from Travel. Times are local at each end (as on the ticket), with that place's time zone when known.",
  input: z.object({
    when: z.enum(["upcoming", "past", "all"]).optional().describe('"upcoming" (default, soonest first), "past" (latest first) or "all"'),
    kind: z.enum(["flight", "train"]).optional(),
    from: date.optional().describe("Only journeys departing on or after this day"),
    to: date.optional().describe("Only journeys departing on or before this day"),
  }),
  async run({ when = "upcoming", kind, from, to }, { userId, today, format }) {
    const all = await listJourneys(userId);
    const startKey = (j: (typeof all)[number]) => `${j.departureDate}${j.departureTime ?? ""}`;
    const journeys = all
      .filter((j) => !kind || j.kind === kind)
      .filter((j) => (when === "upcoming" ? j.departureDate >= today : when === "past" ? j.departureDate < today : true))
      .filter((j) => (!from || j.departureDate >= from) && (!to || j.departureDate <= to))
      .sort((a, b) => (when === "past" ? startKey(b).localeCompare(startKey(a)) : startKey(a).localeCompare(startKey(b))));
    const clock = (hhmm: string | null) => {
      if (!hhmm) return undefined;
      const [h, m] = hhmm.split(":").map(Number);
      return format.time(new Date(2000, 0, 1, h, m));
    };
    return {
      total: journeys.length,
      journeys: journeys.slice(0, 30).map((j) => ({
        kind: j.kind,
        link: `/travel?journey=${j.id}`,
        name: `${j.carrier} ${j.number}`,
        carrier: j.carrierName,
        from: [j.origin, j.originName ?? j.originCity].filter(Boolean).join(" "),
        to: [j.destination, j.destinationName ?? j.destinationCity].filter(Boolean).join(" "),
        departureDate: j.departureDate,
        departureText: [format.dayWithWeekday(j.departureDate), clock(j.departureTime)].filter(Boolean).join(", "),
        departureTimeZone: j.departureTz ?? undefined,
        arrivalText: j.arrivalTime
          ? [format.dayWithWeekday(j.arrivalDate ?? j.departureDate), clock(j.arrivalTime)].join(", ")
          : undefined,
        arrivalTimeZone: j.arrivalTz ?? undefined,
        seat: j.seat ?? undefined,
        bookingRef: j.bookingRef ?? undefined,
        notes: clip(j.notes, 200),
      })),
    };
  },
});

const PROPOSED =
  "Shown to the user with Confirm and Dismiss buttons. It is NOT saved until they confirm; don't say it is done.";

const proposeTaskTool = tool({
  name: "propose_task",
  label: "Preparing a task",
  description: "Propose a new task. The user confirms it in the app before it is created.",
  input: z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    dueDate: date.optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    tags: z.array(z.string()).max(10).optional(),
  }),
  async run(input, { propose }) {
    const parsed = createTaskInput.safeParse(input);
    if (!parsed.success) throw new ToolError(parsed.error.issues[0]?.message ?? "Invalid task");
    propose({ id: randomUUID(), kind: "create_task", input });
    return PROPOSED;
  },
});

const proposeTaskUpdateTool = tool({
  name: "propose_task_update",
  label: "Preparing a change",
  description:
    "Propose changing an existing task (by id from list_tasks), e.g. marking it done or moving its due date. The user confirms before anything changes.",
  input: z.object({
    taskId: z.uuid(),
    title: z.string().min(1).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    dueDate: date.nullable().optional().describe("null removes the due date"),
  }),
  async run({ taskId, ...changes }, { userId, propose }) {
    const task = await getTask(userId, taskId);
    if (!task) throw new ToolError("No task with that id");
    const parsed = updateTaskInput.safeParse(changes);
    if (!parsed.success) throw new ToolError(parsed.error.issues[0]?.message ?? "Nothing to change");
    propose({ id: randomUUID(), kind: "update_task", taskId, taskTitle: task.title, changes });
    return PROPOSED;
  },
});

const proposeJourneyTool = tool({
  name: "propose_journey",
  label: "Preparing a journey",
  description:
    "Propose adding one flight or train journey to Travel, e.g. one leg of a booking the user pasted. Call it once per leg (each flight or train, including returns and connections). The user confirms each before it is saved.",
  input: z.object({
    kind: z.enum(["flight", "train"]),
    carrier: z
      .string()
      .min(1)
      .describe("Flights: the airline's two-letter IATA code (e.g. AF, 3U). Trains: the company (e.g. SNCF, China Railway)"),
    number: z
      .string()
      .optional()
      .describe("Flight or train number without the airline code, e.g. 8888 or G1234. Leave it out if the ticket has none (regional trains); never write N/A"),
    origin: z.string().min(1).describe("Flights: the airport's three-letter IATA code (e.g. PEK). Trains: the station name"),
    destination: z.string().min(1).describe("Like origin"),
    departureDate: date.describe("Local date at the origin"),
    departureTime: z.string().regex(/^\d{2}:\d{2}$/).optional().describe("Local time at the origin, HH:mm, as printed"),
    arrivalDate: date.optional().describe("Local date at the destination, if different or known"),
    arrivalTime: z.string().regex(/^\d{2}:\d{2}$/).optional().describe("Local time at the destination, HH:mm"),
    stopover: z.string().optional().describe("Flights with a stop on the same flight number: the airport code"),
    originCity: z
      .string()
      .optional()
      .describe(
        "Trains: always give the city the origin station is in, even when the ticket names only the station (Paris for Paris Gare de Lyon, 上海 for 上海虹桥站). It places the station for the weather"
      ),
    destinationCity: z.string().optional().describe("Trains: always give the destination station's city, like originCity"),
    seat: z.string().optional(),
    coach: z.string().optional().describe("Trains"),
    gate: z.string().optional().describe("Flights"),
    vehicle: z.string().optional().describe("Aircraft type, or train type such as TGV INOUI"),
    price: z.number().nonnegative().optional().describe("Price of this leg, if the booking says"),
    currency: z.string().regex(/^[A-Za-z]{3}$/).optional().describe("ISO code, e.g. EUR, CNY"),
    bookingRef: z.string().optional().describe("Booking reference / PNR, e.g. K7XQ2M (also labelled 订单号, Référence, Record locator)"),
    notes: z
      .string()
      .optional()
      .describe("Anything else useful (e.g. cabin class). Not the booking reference (use bookingRef), and no ticket or ID numbers"),
  }),
  async run(input, { userId, propose }) {
    const full = {
      stopover: null,
      originCity: null,
      destinationCity: null,
      departureTime: null,
      arrivalDate: null,
      arrivalTime: null,
      seat: null,
      gate: null,
      coach: null,
      vehicle: null,
      aircraftReg: null,
      currency: null,
      bookingRef: null,
      notes: null,
      ...input,
      number: input.number?.replace(/^(n\/?a|none|-)$/i, "") ?? "",
      // The usual reminder for the kind, as for journeys added in the app
      remindBefore: DEFAULT_REMIND_BEFORE[input.kind],
      price: input.price !== undefined ? String(input.price) : null,
    };
    // The same checks as the Travel form (codes, dates, times)
    const parsed = journeyInput.safeParse(full);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ToolError(`${issue?.path.join(".") || "input"}: ${issue?.message ?? "invalid journey"}`);
    }
    const j = parsed.data;
    const existing = await listJourneys(userId);
    // Same rule as the database: same service, day, origin and time
    const same = (e: (typeof existing)[number]) =>
      e.kind === j.kind &&
      e.carrier === j.carrier &&
      e.number === j.number &&
      e.departureDate === j.departureDate &&
      e.origin === j.origin &&
      (e.departureTime ?? "") === (j.departureTime ?? "");
    if (existing.some(same)) {
      return "This journey is already in the user's Travel list; no proposal was made.";
    }
    propose({ id: randomUUID(), kind: "create_journey", input: full });
    return PROPOSED;
  },
});

const proposeEventTool = tool({
  name: "propose_event",
  label: "Preparing an event",
  description:
    "Propose a new calendar event. Either all-day (date, optional endDate) or timed (start and end as local date-times in the user's time zone). The user confirms before it is created.",
  input: z.object({
    title: z.string().min(1),
    notes: z.string().optional(),
    allDay: z.boolean(),
    date: date.optional().describe("All-day events: first day"),
    endDate: date.optional().describe("All-day events: last day, if more than one"),
    start: localDateTime.optional().describe("Timed events, e.g. 2026-10-16T09:30"),
    end: localDateTime.optional().describe("Timed events"),
  }),
  async run({ title, notes, allDay, date: day, endDate, start, end }, { timeZone, propose }) {
    const input = allDay
      ? day
        ? { title, notes, allDay: true as const, startDate: day, endDate: endDate ?? day }
        : null
      : start && end
        ? {
            title,
            notes,
            allDay: false as const,
            startsAt: wallClockToIso(start, timeZone),
            endsAt: wallClockToIso(end, timeZone),
          }
        : null;
    if (!input) throw new ToolError(allDay ? "All-day events need `date`" : "Timed events need `start` and `end`");
    const parsed = createEventInput.safeParse(input);
    if (!parsed.success) throw new ToolError(parsed.error.issues[0]?.message ?? "Invalid event");
    propose({ id: randomUUID(), kind: "create_event", input });
    return PROPOSED;
  },
});

// Notes the assistant writes are Markdown, turned into the editor's format
// when the user confirms
const MAX_NOTE_MARKDOWN = 20_000;
// Lengths are checked here rather than stated in the schema: Gemini fails
// with a server error on maxLength
const upTo = (max: number) => z.string().refine((s) => s.length <= max, `At most ${max} characters`);
const noteTitle = upTo(200).refine((s) => s.trim().length > 0, "The title is empty");
const noteTags = z.array(upTo(32).refine((s) => s.trim().length > 0, "Tags cannot be empty")).max(10);

const proposeNoteTool = tool({
  name: "propose_note",
  label: "Preparing a note",
  description:
    "Propose a new note with a body you write in Markdown. The user confirms it before it is created. Not for moving text out of an existing note: use propose_note_split for that.",
  input: z.object({
    title: noteTitle,
    markdown: upTo(MAX_NOTE_MARKDOWN).describe("The body in Markdown, without the title"),
    tags: noteTags.optional().describe("Without the #"),
  }),
  async run({ title, markdown, tags }, { propose }) {
    propose({ id: randomUUID(), kind: "create_note", input: { title, markdown, tags } });
    return PROPOSED;
  },
});

const proposeNoteUpdateTool = tool({
  name: "propose_note_update",
  label: "Preparing a change",
  description:
    "Propose changing a note (by id from list_notes or search_notes): rename it, replace its tags, or add Markdown at its end. The rest of its text can't be rewritten. The user confirms before anything changes.",
  input: z.object({
    noteId: z.uuid(),
    title: noteTitle.optional(),
    tags: noteTags.optional().describe("The note's full new list of tags, without the #"),
    appendMarkdown: upTo(MAX_NOTE_MARKDOWN).optional().describe("Added after the note's last line"),
  }),
  async run({ noteId, ...changes }, { userId, propose }) {
    const note = await getNote(userId, noteId);
    if (!note) throw new ToolError("No note with that id");
    if (!Object.values(changes).some((v) => v !== undefined)) throw new ToolError("Nothing to change");
    propose({ id: randomUUID(), kind: "update_note", noteId, noteTitle: note.title || "Untitled", changes });
    return PROPOSED;
  },
});

const splitRule = {
  noteId: z.uuid(),
  headingLevel: z.number().int().min(1).max(3).optional().describe("Split at each heading of this level (1–3)"),
  lineStartsWith: upTo(100)
    .optional()
    .describe('Or split at each line starting with this text, e.g. "File:" (any case)'),
};

// The note and how it splits, or a ToolError the model can correct
async function noteSplit(userId: string, { noteId, headingLevel, lineStartsWith }: { noteId: string } & NoteSplitRule) {
  const note = await getNote(userId, noteId);
  if (!note) throw new ToolError("No note with that id");
  try {
    return { note, split: splitNoteContent(note.content, { headingLevel, lineStartsWith }) };
  } catch (err) {
    throw new ToolError((err as Error).message);
  }
}

const previewNoteSplitTool = tool({
  name: "preview_note_split",
  label: "Looking at how a note splits",
  description:
    "Show how a note would split into several: what stays in it and the parts that would each become a new note (heading line, length, start). Nothing changes. Use it before propose_note_split, also to choose the rule.",
  input: z.object(splitRule),
  async run(rule, { userId }) {
    const { note, split } = await noteSplit(userId, rule);
    const start = (text: string) => clip(text.trim(), 120);
    return {
      note: note.title || "Untitled",
      stays: { length: noteText(split.kept).length, start: start(noteText(split.kept)) },
      newNotes: split.parts.map((part, i) => {
        const text = noteText(part.content);
        return { n: i + 1, heading: part.heading, length: text.length, start: start(text) };
      }),
    };
  },
});

const proposeNoteSplitTool = tool({
  name: "propose_note_split",
  label: "Preparing a split",
  description:
    "Propose splitting a long note: each part after the first moves, unchanged (formatting, code and images included), into a new note with the original's tags; the original keeps the first part. The split is done in the app, so never copy the note's text yourself. Call preview_note_split first. The user confirms before anything changes.",
  input: z.object({
    ...splitRule,
    titles: z
      .array(noteTitle)
      .max(MAX_SPLIT_PARTS)
      .optional()
      .describe("One title per new note, in order, as many as preview_note_split listed. Without them, each part's heading line is its title"),
  }),
  async run({ titles, ...rule }, { userId, propose }) {
    const { note, split } = await noteSplit(userId, rule);
    const names = titles ?? split.parts.map((p) => p.heading.slice(0, 200));
    if (names.length !== split.parts.length) {
      throw new ToolError(`The note splits into ${split.parts.length} new notes, but ${names.length} titles were given`);
    }
    propose({
      id: randomUUID(),
      kind: "split_note",
      noteId: note.id,
      noteTitle: note.title || "Untitled",
      input: {
        headingLevel: rule.headingLevel,
        lineStartsWith: rule.lineStartsWith,
        titles: names,
        expectedUpdatedAt: note.updatedAt.toISOString(),
      },
    });
    return `${PROPOSED} It would create ${names.length} notes.`;
  },
});

const TOOLS = [
  listTasksTool,
  listEventsTool,
  searchNotesTool,
  listNotesTool,
  readNoteTool,
  previewNoteSplitTool,
  weatherTool,
  listJourneysTool,
  proposeTaskTool,
  proposeTaskUpdateTool,
  proposeEventTool,
  proposeJourneyTool,
  proposeNoteTool,
  proposeNoteUpdateTool,
  proposeNoteSplitTool,
] as Tool<z.ZodType>[];

export const TOOL_SPECS: ToolSpec[] = TOOLS.map((t) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $schema, ...schema } = z.toJSONSchema(t.input) as Record<string, unknown>;
  return { name: t.name, description: t.description, inputSchema: schema };
});

export const toolLabel = (name: string) => TOOLS.find((t) => t.name === name)?.label ?? "Working";

// Runs one tool call; failures become error results the model can act on
export async function runTool(name: string, input: unknown, ctx: ToolContext) {
  const t = TOOLS.find((candidate) => candidate.name === name);
  if (!t) return { content: `Unknown tool “${name}”`, isError: true };
  const parsed = t.input.safeParse(input);
  if (!parsed.success) {
    return { content: `Invalid input: ${z.prettifyError(parsed.error)}`, isError: true };
  }
  try {
    const result = await t.run(parsed.data, ctx);
    return { content: typeof result === "string" ? result : JSON.stringify(result) };
  } catch (err) {
    if (err instanceof ToolError) return { content: err.message, isError: true };
    console.error(`Assistant tool ${name} failed`, err);
    return { content: "The tool failed unexpectedly", isError: true };
  }
}
