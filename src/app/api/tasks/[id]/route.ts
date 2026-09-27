// src/app/api/tasks/[id]/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteTask,
  getTask,
  TaskInputError,
  updateTask,
  updateTaskInput,
} from "@/server/tasks";
import {
  getUserId,
  notFound,
  parseInput,
  unauthorized,
} from "@/server/session";

type Context = { params: Promise<{ id: string }> };

const isUuid = (id: string) => z.string().uuid().safeParse(id).success;

export async function GET(_request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  const task = isUuid(id) ? await getTask(userId, id) : null;
  return task ? NextResponse.json(task) : notFound();
}

export async function PATCH(request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!isUuid(id)) return notFound();

  const input = await parseInput(
    updateTaskInput,
    await request.json().catch(() => null)
  );
  if ("response" in input) return input.response;

  try {
    const task = await updateTask(userId, id, input.data);
    return task ? NextResponse.json(task) : notFound();
  } catch (err) {
    if (err instanceof TaskInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(_request: Request, { params }: Context) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!isUuid(id) || !(await deleteTask(userId, id))) return notFound();
  return new NextResponse(null, { status: 204 });
}
