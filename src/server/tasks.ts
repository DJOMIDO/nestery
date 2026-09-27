// src/server/tasks.ts
// Task data access. Every function is scoped to the given user.

import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { projects, tasks } from "@/db/schema";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/tasks";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date, expected YYYY-MM-DD");

const taskFields = {
  title: z.string().trim().min(1, "Task title is required"),
  description: z.string().nullish(),
  projectId: z.string().uuid("Invalid project").nullish(),
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
  status: taskFields.status.default("todo"),
  priority: taskFields.priority.default("medium"),
});

export const updateTaskInput = z
  .object(taskFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const listTasksInput = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  projectId: z.string().uuid("Invalid project").optional(),
  dueFrom: dateString.optional(),
  dueTo: dateString.optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskInput>;
export type UpdateTaskInput = z.infer<typeof updateTaskInput>;
export type ListTasksInput = z.infer<typeof listTasksInput>;

export class TaskInputError extends Error {}

const taskColumns = {
  id: tasks.id,
  userId: tasks.userId,
  projectId: tasks.projectId,
  projectName: projects.name,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  priority: tasks.priority,
  dueDate: tasks.dueDate,
  remindAt: tasks.remindAt,
  completedAt: tasks.completedAt,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
};

function selectTasks() {
  return db
    .select(taskColumns)
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id));
}

// Tasks may only be attached to the user's own projects
async function assertOwnProject(userId: string, projectId?: string | null) {
  if (!projectId) return;
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId)));
  if (!project) throw new TaskInputError("Project not found");
}

export async function listTasks(userId: string, filter: ListTasksInput = {}) {
  const conditions: SQL[] = [eq(tasks.userId, userId)];
  if (filter.status) conditions.push(eq(tasks.status, filter.status));
  if (filter.projectId) conditions.push(eq(tasks.projectId, filter.projectId));
  if (filter.dueFrom) conditions.push(gte(tasks.dueDate, filter.dueFrom));
  if (filter.dueTo) conditions.push(lte(tasks.dueDate, filter.dueTo));

  return selectTasks()
    .where(and(...conditions))
    .orderBy(desc(tasks.createdAt));
}

export async function getTask(userId: string, id: string) {
  const [task] = await selectTasks().where(
    and(eq(tasks.id, id), eq(tasks.userId, userId))
  );
  return task ?? null;
}

export async function createTask(userId: string, input: CreateTaskInput) {
  await assertOwnProject(userId, input.projectId);
  const [{ id }] = await db
    .insert(tasks)
    .values({
      userId,
      title: input.title,
      description: input.description ?? null,
      projectId: input.projectId ?? null,
      status: input.status,
      priority: input.priority,
      dueDate: input.dueDate ?? null,
      remindAt: input.remindAt ? new Date(input.remindAt) : null,
      completedAt: input.status === "done" ? new Date() : null,
    })
    .returning({ id: tasks.id });
  return (await getTask(userId, id))!;
}

// Returns null when the task does not exist or belongs to another user
export async function updateTask(
  userId: string,
  id: string,
  input: UpdateTaskInput
) {
  await assertOwnProject(userId, input.projectId);

  const values: Partial<typeof tasks.$inferInsert> = {};
  if (input.title !== undefined) values.title = input.title;
  if (input.description !== undefined) values.description = input.description;
  if (input.projectId !== undefined) values.projectId = input.projectId;
  if (input.priority !== undefined) values.priority = input.priority;
  if (input.dueDate !== undefined) values.dueDate = input.dueDate;
  if (input.remindAt !== undefined) {
    values.remindAt = input.remindAt ? new Date(input.remindAt) : null;
  }
  if (input.status !== undefined) {
    values.status = input.status;
    values.completedAt = input.status === "done" ? new Date() : null;
  }

  const [updated] = await db
    .update(tasks)
    .set(values)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning({ id: tasks.id });
  return updated ? getTask(userId, id) : null;
}

// Returns false when the task does not exist or belongs to another user
export async function deleteTask(userId: string, id: string) {
  const deleted = await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning({ id: tasks.id });
  return deleted.length > 0;
}

