// src/lib/auth-client.ts
// Client-side auth helpers backed by Better Auth.

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

// Carries Better Auth's error code (e.g. EMAIL_NOT_VERIFIED) so pages can
// react to specific cases
export class AuthError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

const unwrap = <T>(result: {
  data: T;
  error: { message?: string; code?: string } | null;
}) => {
  if (result.error) {
    throw new AuthError(result.error.message || "Authentication failed", result.error.code);
  }
  return result.data;
};

// When email verification is required no session is created: the result's
// token is null and the user has to follow the link in their inbox first
export const signUpWithEmail = async (
  email: string,
  password: string,
  username: string
) =>
  unwrap(
    await authClient.signUp.email({ email, password, name: username, callbackURL: "/dashboard" })
  );

export const signInWithEmail = async (email: string, password: string) =>
  unwrap(await authClient.signIn.email({ email, password }));

export const signInWithGitHub = async () =>
  unwrap(
    await authClient.signIn.social({
      provider: "github",
      callbackURL: "/dashboard",
    })
  );

export const signOut = async () => unwrap(await authClient.signOut());

// Sends a reset link if an account exists (the answer is the same either
// way, so it can't be used to find out who has an account)
export const requestPasswordReset = async (email: string) =>
  unwrap(await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" }));

export const resetPassword = async (token: string, newPassword: string) =>
  unwrap(await authClient.resetPassword({ token, newPassword }));

export const resendVerificationEmail = async (email: string) =>
  unwrap(await authClient.sendVerificationEmail({ email, callbackURL: "/dashboard" }));
