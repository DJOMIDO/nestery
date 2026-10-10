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
    "List the user's notes, pinned first, then most recently edited, with the start of each. Use it for questions about the notes in general; use search_notes to find specific content.",
  input: z.object({
    limit: z.number().int().min(1).max(50).optional().describe("How many notes (default 20)"),
  }),
  async run({ limit = 20 }, { userId, format }) {
    const notes = await listNotes(userId);
    return {
      total: notes.length,
      notes: notes.slice(0, limit).map((n) => ({
        id: n.id,
        link: noteHref(n.id),
        title: n.title || "Untitled",
        pinned: n.pinned || undefined,
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
    "Find the user's notes containing all the given words (title or text, any case). Returns excerpts; use read_note for a whole note.",
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
    return { title: note.title || "Untitled", link: noteHref(note.id), text: clip(note.contentText, 12_000) ?? "" };
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
      temperatureUnit: "°C",
      days: (await dailyForecast(where, timeZone, days)).map((d) => ({ ...d, dateText: format.dayWithWeekday(d.date) })),
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
    originCity: z.string().optional().describe("Trains: the city of the origin station"),
    destinationCity: z.string().optional().describe("Trains: the city of the destination station"),
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

const TOOLS = [
  listTasksTool,
  listEventsTool,
  searchNotesTool,
  listNotesTool,
  readNoteTool,
  weatherTool,
  listJourneysTool,
  proposeTaskTool,
  proposeTaskUpdateTool,
  proposeEventTool,
  proposeJourneyTool,
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
