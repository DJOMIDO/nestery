// src/lib/authSchema.ts

import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  // No length rule here: accounts created before the 8-character minimum
  // may have shorter passwords, and the server decides anyway
  password: z.string().min(1, { message: "Enter your password" }),
});

export const signUpSchema = z
  .object({
    username: z.string().min(2, { message: "Username must be at least 2 characters" }),
    email: z.string().email({ message: "Invalid email address" }),
    password: z.string().min(8, { message: "Password must be at least 8 characters" }),
    confirmPassword: z.string().min(1, { message: "Please confirm your password" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
