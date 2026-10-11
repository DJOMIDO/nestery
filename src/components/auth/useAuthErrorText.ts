// src/components/auth/useAuthErrorText.ts

import { useTranslations } from "next-intl";
import { AuthError } from "@/lib/auth-client";

// Better Auth's errors come in English with a code: the common ones get the
// interface language's wording, the rest keep the server's message
const KNOWN = {
  INVALID_EMAIL_OR_PASSWORD: "INVALID_EMAIL_OR_PASSWORD",
  USER_ALREADY_EXISTS: "USER_ALREADY_EXISTS",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "USER_ALREADY_EXISTS",
  PASSWORD_TOO_SHORT: "PASSWORD_TOO_SHORT",
  INVALID_TOKEN: "INVALID_TOKEN",
} as const;

export function useAuthErrorText() {
  const t = useTranslations("auth");
  return (error: unknown) => {
    const code = error instanceof AuthError && error.code ? KNOWN[error.code as keyof typeof KNOWN] : undefined;
    if (code) return t(`errors.${code}`);
    return error instanceof Error && error.message ? error.message : t("unexpected");
  };
}
