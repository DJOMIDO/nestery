// src/server/projects.ts
// Project data access. Every function is scoped to the given user.

import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
  .nullish();

export const createProjectInput = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  description: z.string().nullish(),
  startDate: dateString,
  dueDate: dateString,
  visibility: z.enum(["public", "private"]).default("private"),
  tags: z.array(z.string()).default([]),
});

export type CreateProjectInput = z.infer<typeof createProjectInput>;

export async function listProjects(userId: string) {
  return db
    .select()
    .from(projects)
    .where(eq(projects.ownerId, userId))
    .orderBy(desc(projects.createdAt));
}

export async function createProject(userId: string, input: CreateProjectInput) {
  const [project] = await db
    .insert(projects)
    .values({
      name: input.name,
      description: input.description ?? null,
      ownerId: userId,
      startDate: input.startDate ?? null,
      dueDate: input.dueDate ?? null,
      visibility: input.visibility,
      tags: input.tags,
    })
    .returning();
  return project;
}
