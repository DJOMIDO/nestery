// src/db/schema.ts

import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  integer,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/tasks";
import type { NoteContent } from "@/lib/notes";
import type { WeatherPlace } from "@/lib/weather";
import { JOURNEY_KINDS } from "@/lib/travel";

// ---------------------------------------------------------------------------
// Better Auth tables (user / session / account / verification).
// Keep in sync with Better Auth's core schema: `npx @better-auth/cli generate`.
// Column names are snake_case in the database via `casing: "snake_case"`.
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = pgTable(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: timestamp().notNull(),
    token: text().notNull().unique(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)]
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp(),
    refreshTokenExpiresAt: timestamp(),
    scope: text(),
    password: text(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("account_user_id_idx").on(t.userId)]
);

export const verification = pgTable(
  "verification",
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
    updatedAt: timestamp()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)]
);

// Login attempt counters for Better Auth's rate limiting. Kept in the database
// because serverless instances don't share memory.
export const rateLimit = pgTable("rate_limit", {
  id: text().primaryKey(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint({ mode: "number" }).notNull(),
});

// ---------------------------------------------------------------------------
// App tables
// ---------------------------------------------------------------------------

export const taskStatus = pgEnum("task_status", TASK_STATUSES);
export const taskPriority = pgEnum("task_priority", TASK_PRIORITIES);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text().notNull(),
    description: text(),
    tags: text().array().notNull().default([]),
    status: taskStatus().notNull().default("todo"),
    priority: taskPriority().notNull().default("medium"),
    dueDate: date(),
    remindAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("tasks_user_id_idx").on(t.userId)]
);

export const notes = pgTable(
  "notes",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text().notNull().default(""),
    // Editor document (Tiptap JSON); contentText is its plain text for previews and search
    content: jsonb().$type<NoteContent>().notNull(),
    contentText: text().notNull().default(""),
    // Shared with tasks' tags (the same names, suggested across both)
    tags: text().array().notNull().default([]),
    pinned: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("notes_user_id_idx").on(t.userId)]
);

// Timed events use startsAt/endsAt; all-day events use startDate/endDate
// (inclusive) so they stay on their calendar days in any time zone.
export const events = pgTable(
  "events",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text().notNull(),
    notes: text(),
    allDay: boolean().notNull().default(false),
    startsAt: timestamp({ withTimezone: true }),
    endsAt: timestamp({ withTimezone: true }),
    startDate: date(),
    endDate: date(),
    // Repeating events: an RFC 5545 RRULE (e.g. "FREQ=WEEKLY;BYDAY=MO,WE"),
    // and the local dates of occurrences that were deleted or edited on their own
    rrule: text(),
    exdates: date().array().notNull().default([]),
    // An occurrence edited on its own becomes an event pointing at its series,
    // and goes away with it
    seriesId: uuid().references((): AnyPgColumn => events.id, { onDelete: "cascade" }),
    // UID from an imported .ics file, so importing it again skips this event
    icsUid: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("events_user_starts_at_idx").on(t.userId, t.startsAt),
    index("events_user_start_date_idx").on(t.userId, t.startDate),
    // NULLs never collide, so only imported events are constrained
    uniqueIndex("events_user_ics_uid_idx").on(t.userId, t.icsUid),
  ]
);

// Per-user preferences, one row per user (created on first save)
export const userSettings = pgTable("user_settings", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  // ISO 3166-1 alpha-2 codes, e.g. ["FR", "CN"]
  holidayCountries: text().array().notNull().default([]),
  // The interface language ("en", "zh-CN", "zh-TW", "fr"); null follows the
  // browser. The NEXT_LOCALE cookie mirrors it for each request.
  language: text(),
  // How dates are written (a BCP 47 locale such as "en-US" or "zh-CN"); null
  // follows the interface language
  dateLocale: text(),
  // "h12" or "h23"; null follows the date locale
  hourCycle: text(),
  // 1 = Monday, 0 = Sunday
  weekStart: smallint().notNull().default(1),
  // The browser's IANA time zone, kept up to date by the app; the calendar
  // feed uses it to place repeating events on the right wall-clock time
  timeZone: text(),
  // Secret for the calendar feed URL (/api/calendar/feed/<token>); null = off
  feedToken: text().unique(),
  // Place for the dashboard's weather (Settings > Weather); null = not set
  weatherPlace: jsonb().$type<WeatherPlace>(),
  // "C" or "F"; null follows the date format (°F for US English)
  temperatureUnit: text(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// External calendars (ICS feeds) shown read-only next to the user's events.
// The last fetched feed is cached and refreshed when it gets stale.
export const calendarSubscriptions = pgTable(
  "calendar_subscriptions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
    url: text().notNull(),
    // A key of SUBSCRIPTION_COLORS in src/lib/subscriptions.ts
    color: text().notNull().default("sky"),
    enabled: boolean().notNull().default(true),
    ics: text(),
    lastFetchedAt: timestamp({ withTimezone: true }),
    // Why the last refresh failed; cleared by the next success
    lastError: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("calendar_subscriptions_user_id_idx").on(t.userId)]
);

// The assistant's model provider per user (Settings > Assistant). Kept apart
// from user_settings, which is sent to the browser as a whole: the API key is
// stored encrypted (src/server/secrets.ts) and never leaves the server.
export const assistantSettings = pgTable("assistant_settings", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  // A key of ASSISTANT_PROVIDERS in src/lib/assistant.ts
  provider: text().notNull(),
  model: text().notNull(),
  // OpenAI-compatible providers only; null = the provider's default endpoint
  baseUrl: text(),
  apiKeyEncrypted: text(),
  // Last characters of the key, to show which one is saved
  apiKeyHint: text(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Assistant requests per user and day, for the daily limit
export const assistantUsage = pgTable(
  "assistant_usage",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    day: date().notNull(),
    requests: integer().notNull().default(0),
  },
  (t) => [uniqueIndex("assistant_usage_user_day_idx").on(t.userId, t.day)]
);

// Saved assistant conversations. The provider's own transcript lives on the
// conversation and never leaves the server: the browser sends a
// conversationId with each message and gets the exchange back as it streams.
// Rolling a conversation back (edit and send again, retry) truncates the
// transcript to the length it had before a message, recorded on that message.
export const assistantConversations = pgTable(
  "assistant_conversations",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // From the first message; null while it is only an image
    title: text(),
    // The provider and model the transcript came from: another one's
    // transcript would be rejected, so such a conversation stays read-only
    provider: text().notNull(),
    model: text().notNull(),
    // The provider's native messages, sent to the model with each new one
    transcript: jsonb().$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
    // Outcomes of settled proposals, told to the assistant with the next
    // message (and restored when rolling back to before one)
    pendingNotes: jsonb().$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("assistant_conversations_user_id_idx").on(t.userId)]
);

// The messages of a saved conversation, as the panel shows them: text,
// attachments, proposal cards with their outcome, errors.
export const assistantMessages = pgTable(
  "assistant_messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    conversationId: uuid()
      .notNull()
      .references(() => assistantConversations.id, { onDelete: "cascade" }),
    // Position in the conversation; a rollback deletes from one on
    index: integer().notNull(),
    // "user" | "assistant"
    role: text().notNull(),
    text: text().notNull().default(""),
    // AssistantImage[] on a user message
    images: jsonb().$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
    // { proposal: AssistantProposal; state: ProposalState }[] on a reply
    proposals: jsonb().$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
    // User messages only: the proposal outcomes sent with it, and the
    // transcript length before it, to roll back to that point
    notes: jsonb().$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    historyLength: integer(),
    error: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assistant_messages_conversation_id_idx").on(t.conversationId)]
);

export const journeyKind = pgEnum("journey_kind", JOURNEY_KINDS);

// Flights and train journeys (Travel). Departure and arrival are local
// wall-clock dates and times at each end, with that place's time zone when
// known (flights: from the airport list); null means the user's own zone.
export const journeys = pgTable(
  "journeys",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: journeyKind().notNull(),
    // Airline IATA code (flights) or train company (trains)
    carrier: text().notNull(),
    // Flight or train number, e.g. "933" or "6201"; "" for trains without one
    number: text().notNull(),
    // Airport IATA codes (flights) or station names (trains)
    origin: text().notNull(),
    destination: text().notNull(),
    // Flights only
    stopover: text(),
    // Trains only; flights take the city from the airport list
    originCity: text(),
    destinationCity: text(),
    departureDate: date().notNull(),
    // "HH:mm"
    departureTime: text(),
    arrivalDate: date(),
    arrivalTime: text(),
    departureTz: text(),
    arrivalTz: text(),
    seat: text(),
    // Gate (flights) or coach (trains)
    gate: text(),
    coach: text(),
    // Aircraft type (flights) or train type such as "TGV" (trains)
    vehicle: text(),
    aircraftReg: text(),
    price: numeric({ precision: 12, scale: 2 }),
    // ISO 4217, e.g. "EUR"
    currency: text(),
    bookingRef: text(),
    notes: text(),
    // Remind this many minutes before departure (needs a departure time);
    // null = no reminder
    remindBefore: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("journeys_user_departure_idx").on(t.userId, t.departureDate),
    // The same flight or train from the same place at the same time is one
    // journey (re-imports skip it). Origin and time matter for trains without
    // a number (regional tickets), e.g. a same-day return.
    uniqueIndex("journeys_unique_idx").on(
      t.userId,
      t.kind,
      t.carrier,
      t.number,
      t.departureDate,
      t.origin,
      sql`coalesce(${t.departureTime}, '')`
    ),
  ]
);

// Files attached to notes (images shown inline, others as links), stored in
// Neon Object Storage under `storageKey`. A note's deletion leaves its files
// without a note for a while, so undoing it can claim them back; files left
// without any note are removed later (src/server/attachments.ts).
export const noteAttachments = pgTable(
  "note_attachments",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    noteId: uuid().references(() => notes.id, { onDelete: "set null" }),
    storageKey: text().notNull().unique(),
    fileName: text().notNull(),
    contentType: text().notNull(),
    // Bytes
    size: integer().notNull(),
    // False until the browser's upload is checked
    uploaded: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    // When the file was left without a note; removed a day later unless a
    // note (e.g. one restored with Undo) still shows it
    orphanedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("note_attachments_user_idx").on(t.userId), index("note_attachments_note_idx").on(t.noteId)]
);
