// src/db/index.ts

import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Works with Neon (use the pooled connection string) and with a local Postgres.
export const db = drizzle(process.env.DATABASE_URL!, {
  schema,
  casing: "snake_case",
});
