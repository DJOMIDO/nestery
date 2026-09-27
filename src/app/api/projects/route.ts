// src/app/api/projects/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { auth } from "@/lib/auth";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
  .nullish();

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  description: z.string().nullish(),
  startDate: dateString,
  dueDate: dateString,
  visibility: z.enum(["public", "private"]).default("private"),
  tags: z.array(z.string()).default([]),
});

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only the current user's projects, newest first
  const data = await db
    .select()
    .from(projects)
    .where(eq(projects.ownerId, userId))
    .orderBy(desc(projects.createdAt));

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createProjectSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { name, description, startDate, dueDate, visibility, tags } =
    parsed.data;

  const [project] = await db
    .insert(projects)
    .values({
      name,
      description: description ?? null,
      ownerId: userId,
      startDate: startDate ?? null,
      dueDate: dueDate ?? null,
      visibility,
      tags,
    })
    .returning();

  return NextResponse.json(project, { status: 201 });
}
