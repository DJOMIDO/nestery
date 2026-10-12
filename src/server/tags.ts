// src/server/tags.ts
// Tags, shared by tasks and notes: the same rules, and one list of names to
// suggest from.

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { notes, tasks } from "@/db/schema";

export const tagList = z
  .array(z.string().trim().min(1, "Tags cannot be empty").max(32, "Tags must be at most 32 characters"))
  .max(10, "At most 10 tags")
  .transform((tags) => [...new Set(tags)]);

// Every tag the user has, with how many tasks and notes carry it, most used
// first
export async function listTags(userId: string) {
  const rows = await db.execute<{ tag: string; count: number }>(sql`
    select tag, count(*)::int as count from (
      select unnest(${tasks.tags}) as tag from ${tasks} where ${eq(tasks.userId, userId)}
      union all
      select unnest(${notes.tags}) as tag from ${notes} where ${eq(notes.userId, userId)}
    ) all_tags
    group by tag
    order by count desc, tag
  `);
  return rows.rows;
}
