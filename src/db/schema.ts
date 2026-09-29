// src/db/schema.ts

import {
  boolean,
  date,
  index,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/tasks";
import type { NoteContent } from "@/lib/notes";

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
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("events_user_starts_at_idx").on(t.userId, t.startsAt),
    index("events_user_start_date_idx").on(t.userId, t.startDate),
  ]
);

// Per-user preferences, one row per user (created on first save)
export const userSettings = pgTable("user_settings", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  // ISO 3166-1 alpha-2 codes, e.g. ["FR", "CN"]
  holidayCountries: text().array().notNull().default([]),
  // How dates are written (a BCP 47 locale such as "en-US" or "zh-CN")
  dateLocale: text().notNull().default("en-US"),
  // "h12" or "h23"; null follows the date locale
  hourCycle: text(),
  // 1 = Monday, 0 = Sunday
  weekStart: smallint().notNull().default(1),
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
