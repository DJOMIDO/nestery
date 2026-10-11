// src/lib/authSchema.ts
// Form rules for signing in and up. `t` gives the messages in the interface
// language (useTranslations("auth.validation")).

import { z } from "zod";

type Messages = (key: "email" | "password" | "username" | "passwordLength" | "confirm" | "mismatch") => string;

export const signInSchema = (t: Messages) =>
  z.object({
    email: z.string().email({ message: t("email") }),
    // No length rule here: accounts created before the 8-character minimum
    // may have shorter passwords, and the server decides anyway
    password: z.string().min(1, { message: t("password") }),
  });

export const signUpSchema = (t: Messages) =>
  z
    .object({
      username: z.string().min(2, { message: t("username") }),
      email: z.string().email({ message: t("email") }),
      password: z.string().min(8, { message: t("passwordLength") }),
      confirmPassword: z.string().min(1, { message: t("confirm") }),
    })
    .refine((data) => data.password === data.confirmPassword, {
      path: ["confirmPassword"],
      message: t("mismatch"),
    });
