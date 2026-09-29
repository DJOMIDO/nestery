// src/lib/auth.ts
// Server-side Better Auth instance. Do not import this from client components.

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

// Social sign-in providers that are configured (both env vars set). The UI
// only offers these, so an unconfigured provider never shows a dead button.
export const socialProviderIds: string[] = githubClientId && githubClientSecret ? ["github"] : [];

// On Vercel, fall back to the deployment's own URL so preview and production
// deployments work without setting BETTER_AUTH_URL.
const vercelHost =
  process.env.VERCEL_ENV === "production"
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL
    : process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;

const vercelOrigins = [
  process.env.VERCEL_URL,
  process.env.VERCEL_BRANCH_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
]
  .filter(Boolean)
  .map((host) => `https://${host}`);

export const auth = betterAuth({
  baseURL:
    process.env.BETTER_AUTH_URL ||
    (vercelHost ? `https://${vercelHost}` : undefined),
  trustedOrigins: vercelOrigins,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    // Applies to new passwords only; sign-in never checks the minimum, so
    // older, shorter passwords keep working
    minPasswordLength: 8,
  },
  user: {
    // Settings > Account; the user's tasks, notes, events etc. cascade
    deleteUser: { enabled: true },
  },
  account: {
    accountLinking: {
      enabled: true,
      // Linking is started by a signed-in user from Settings, so their GitHub
      // email may differ from the one they registered with
      allowDifferentEmails: true,
    },
  },
  // Counters live in the database: serverless instances don't share memory.
  // Enabled in production (Better Auth's default).
  rateLimit: {
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
      "/change-password": { window: 60, max: 5 },
      "/delete-user": { window: 60, max: 5 },
    },
  },
  socialProviders:
    githubClientId && githubClientSecret
      ? {
          github: {
            clientId: githubClientId,
            clientSecret: githubClientSecret,
          },
        }
      : {},
  // nextCookies must be the last plugin.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
