// app/login/page.tsx

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { signInSchema } from "@/lib/authSchema";
import { signInWithEmail } from "@/lib/auth";

type LoginFormData = z.infer<typeof signInSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string>("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setFormError("");
    try {
      await signInWithEmail(data.email, data.password);
      router.push("/dashboard");
    } catch (error: unknown) {
      if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError("An unexpected error occurred.");
      }
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-cover bg-center bg-no-repeat login-bg relative">
      <div className="absolute inset-0 bg-black/40 z-0" />

      <div className="hidden md:flex flex-col justify-center items-center text-white relative z-10 px-8">
        <h1 className="text-5xl font-bold mb-4">Nestery</h1>
        <p className="text-base text-center max-w-sm">
          A powerful team collaboration platform built for the modern workspace.
        </p>
      </div>

      <div className="flex items-center justify-center relative z-10 px-6 py-12">
        <div className="w-full max-w-md bg-background/80 backdrop-blur-md p-8 rounded-2xl shadow-lg space-y-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold">Sign in</h2>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-red-500 text-sm">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register("password")} />
              {errors.password && (
                <p className="text-red-500 text-sm">{errors.password.message}</p>
              )}
            </div>

            {formError && <p className="text-red-500 text-sm">{formError}</p>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="pt-4 border-t text-center space-y-3">
            <p className="text-sm text-muted-foreground">Or continue with</p>
            <Button variant="outline" className="w-full">
              Continue with GitHub
            </Button>
          </div>

          <div className="text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="underline hover:text-primary">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
