// src/app/api/tasks/route.ts

import { NextResponse } from "next/server";
import {
  createTask,
  createTaskInput,
  listTasks,
  listTasksInput,
  TaskInputError,
} from "@/server/tasks";
import { getUserId, parseInput, unauthorized } from "@/server/session";

// GET /api/tasks?status=&projectId=&dueFrom=&dueTo=
export async function GET(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const filter = await parseInput(listTasksInput, params);
  if ("response" in filter) return filter.response;

  return NextResponse.json(await listTasks(userId, filter.data));
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const input = await parseInput(
    createTaskInput,
    await request.json().catch(() => null)
  );
  if ("response" in input) return input.response;

  try {
    return NextResponse.json(await createTask(userId, input.data), {
      status: 201,
    });
  } catch (err) {
    if (err instanceof TaskInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
