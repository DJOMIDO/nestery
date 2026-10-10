// src/lib/auth.ts
// Server-side Better Auth instance. Do not import this from client components.

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { emailEnabled, sendEmail } from "@/server/email";
import { confirmEmailChange, resetPasswordEmail, verifyEmail } from "@/server/emailTemplates";
import { deleteUserFiles } from "@/server/attachments";
import { storageEnabled } from "@/server/storage";
import { SOCIAL_PROVIDERS, type SocialProviderId } from "@/lib/socialProviders";

export { emailEnabled };

const credentials = (prefix: string) => {
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  return clientId && clientSecret ? { clientId, clientSecret } : null;
};

const github = credentials("GITHUB");
const google = credentials("GOOGLE");

const socialProviders = {
  ...(github && { github }),
  // select_account lets people with several Google accounts pick one
  // instead of being signed in with whichever is active
  ...(google && { google: { ...google, prompt: "select_account" as const } }),
};

// Social sign-in providers that are configured (both env vars set). The UI
// only offers these, so an unconfigured provider never shows a dead button.
export const socialProviderIds: SocialProviderId[] = SOCIAL_PROVIDERS.filter((id) => id in socialProviders);

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
    // Only when emails can actually be delivered (SMTP configured)
    requireEmailVerification: emailEnabled,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(resetPasswordEmail(user.email, user.name, url));
    },
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    // Signing in with an unverified email sends a fresh link
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(verifyEmail(user.email, user.name, url));
    },
  },
  user: {
    // Settings > Account; the user's tasks, notes, events etc. cascade
    deleteUser: {
      enabled: true,
      // Note attachments live in object storage, outside the database
      beforeDelete: async (user) => {
        if (storageEnabled()) await deleteUserFiles(user.id);
      },
    },
    // The current address approves first, then the new one is verified
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        await sendEmail(confirmEmailChange(user.email, user.name, newEmail, url));
      },
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      // Linking is started by a signed-in user from Settings, so their GitHub
      // or Google email may differ from the one they registered with
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
      // Each of these sends an email
      "/request-password-reset": { window: 60, max: 3 },
      "/send-verification-email": { window: 60, max: 3 },
      "/change-email": { window: 60, max: 3 },
    },
  },
  socialProviders,
  // nextCookies must be the last plugin.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
