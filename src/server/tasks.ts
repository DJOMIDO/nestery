// src/server/tasks.ts
// Task data access. Every function is scoped to the given user.

import {
  and,
  arrayContains,
  desc,
  eq,
  gte,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/tasks";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date, expected YYYY-MM-DD");

const taskFields = {
  title: z.string().trim().min(1, "Task title is required"),
  description: z.string().nullish(),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Tags cannot be empty")
        .max(32, "Tags must be at most 32 characters")
    )
    .max(10, "At most 10 tags")
    .transform((tags) => [...new Set(tags)]),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  dueDate: dateString.nullish(),
  remindAt: z
    .string()
    .datetime({ offset: true, message: "Invalid reminder time" })
    .nullish(),
};

export const createTaskInput = z.object({
  ...taskFields,
  tags: taskFields.tags.default([]),
  status: taskFields.status.default("todo"),
  priority: taskFields.priority.default("medium"),
});

export const updateTaskInput = z
  .object(taskFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const listTasksInput = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  tag: z.string().trim().min(1).optional(),
  dueFrom: dateString.optional(),
  dueTo: dateString.optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskInput>;
export type UpdateTaskInput = z.infer<typeof updateTaskInput>;
export type ListTasksInput = z.infer<typeof listTasksInput>;

export async function listTasks(userId: string, filter: ListTasksInput = {}) {
  const conditions: SQL[] = [eq(tasks.userId, userId)];
  if (filter.status) conditions.push(eq(tasks.status, filter.status));
  if (filter.tag) conditions.push(arrayContains(tasks.tags, [filter.tag]));
  if (filter.dueFrom) conditions.push(gte(tasks.dueDate, filter.dueFrom));
  if (filter.dueTo) conditions.push(lte(tasks.dueDate, filter.dueTo));

  return db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.createdAt));
}

export async function getTask(userId: string, id: string) {
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  return task ?? null;
}

export async function createTask(userId: string, input: CreateTaskInput) {
  const [task] = await db
    .insert(tasks)
    .values({
      userId,
      title: input.title,
      description: input.description ?? null,
      tags: input.tags,
      status: input.status,
      priority: input.priority,
      dueDate: input.dueDate ?? null,
      remindAt: input.remindAt ? new Date(input.remindAt) : null,
      completedAt: input.status === "done" ? new Date() : null,
    })
    .returning();
  return task;
}

// Returns null when the task does not exist or belongs to another user
export async function updateTask(
  userId: string,
  id: string,
  input: UpdateTaskInput
) {
  const values: PgUpdateSetSource<typeof tasks> = {};
  if (input.title !== undefined) values.title = input.title;
  if (input.description !== undefined) values.description = input.description;
  if (input.tags !== undefined) values.tags = input.tags;
  if (input.priority !== undefined) values.priority = input.priority;
  if (input.dueDate !== undefined) values.dueDate = input.dueDate;
  if (input.remindAt !== undefined) {
    values.remindAt = input.remindAt ? new Date(input.remindAt) : null;
  }
  if (input.status !== undefined) {
    values.status = input.status;
    // Keep the original completion time when a done task is saved again
    values.completedAt =
      input.status === "done"
        ? sql`case when ${tasks.status} = 'done' then ${tasks.completedAt} else now() end`
        : null;
  }

  const [updated] = await db
    .update(tasks)
    .set(values)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning();
  return updated ?? null;
}

// Returns false when the task does not exist or belongs to another user
export async function deleteTask(userId: string, id: string) {
  const deleted = await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning({ id: tasks.id });
  return deleted.length > 0;
}

