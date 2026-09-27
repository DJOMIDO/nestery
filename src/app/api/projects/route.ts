// src/app/api/projects/route.ts

import { NextResponse } from "next/server";
import {
  createProject,
  createProjectInput,
  listProjects,
} from "@/server/projects";
import { getUserId, parseInput, unauthorized } from "@/server/session";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  return NextResponse.json(await listProjects(userId));
}

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  const input = await parseInput(
    createProjectInput,
    await request.json().catch(() => null)
  );
  if ("response" in input) return input.response;

  return NextResponse.json(await createProject(userId, input.data), {
    status: 201,
  });
}
