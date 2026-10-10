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
import type { WeatherPlace } from "@/lib/weather";
import { createEventInput, listEvents } from "@/server/events";
import { getNote, listNotes, searchNotes } from "@/server/notes";
import { subscriptionEvents } from "@/server/subscriptions";
import { createTaskInput, getTask, listTasks, updateTaskInput } from "@/server/tasks";
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
  proposeTaskTool,
  proposeTaskUpdateTool,
  proposeEventTool,
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
