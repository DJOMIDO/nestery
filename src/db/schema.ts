// src/db/schema.ts

import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/tasks";

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

export const projectVisibility = pgEnum("project_visibility", [
  "public",
  "private",
]);

export const projectStatus = pgEnum("project_status", [
  "planned",
  "in_progress",
  "completed",
  "archived",
]);

export const projects = pgTable(
  "projects",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    description: text(),
    ownerId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    startDate: date(),
    dueDate: date(),
    visibility: projectVisibility().notNull().default("private"),
    tags: text().array().notNull().default([]),
    status: projectStatus().notNull().default("planned"),
    progress: integer().notNull().default(0),
    isArchived: boolean().notNull().default(false),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("projects_owner_id_idx").on(t.ownerId)]
);

export const taskStatus = pgEnum("task_status", TASK_STATUSES);
export const taskPriority = pgEnum("task_priority", TASK_PRIORITIES);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: uuid().references(() => projects.id, { onDelete: "set null" }),
    title: text().notNull(),
    description: text(),
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
  (t) => [
    index("tasks_user_id_idx").on(t.userId),
    index("tasks_project_id_idx").on(t.projectId),
  ]
);
