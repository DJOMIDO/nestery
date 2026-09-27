// src/lib/auth-client.ts
// Client-side auth helpers backed by Better Auth.

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

const unwrap = <T>(result: {
  data: T;
  error: { message?: string } | null;
}) => {
  if (result.error) {
    throw new Error(result.error.message || "Authentication failed");
  }
  return result.data;
};

export const signUpWithEmail = async (
  email: string,
  password: string,
  username: string
) => unwrap(await authClient.signUp.email({ email, password, name: username }));

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
