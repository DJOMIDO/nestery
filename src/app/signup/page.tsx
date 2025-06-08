// app/signup/page.tsx

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { signUpSchema } from "@/lib/authSchema";
import { signUpWithEmail } from "@/lib/auth";

import { GithubLoginButton } from "@/components/GithubLoginButton";
import { signInWithGitHub } from "@/lib/auth";

import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

type FormData = z.infer<typeof signUpSchema>;

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter(); // ✅ 用于跳转登录页

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = async (data: FormData) => {
    setError(null);
    setSuccess(null);
    try {
      await signUpWithEmail(data.email, data.password, data.username);
      setSuccess("Sign up successful. Please check your email to verify.");

      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong");
      }
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-cover bg-center bg-no-repeat signup-bg relative">
      <div className="absolute inset-0 bg-black/40 z-0" />

      <div className="hidden md:flex flex-col justify-center items-center text-white relative z-10 px-8">
        <h1 className="text-5xl font-bold mb-4">Nestery</h1>
        <p className="text-base text-center max-w-sm">
          Join the team and build something great together.
        </p>
      </div>

      <div className="flex items-center justify-center relative z-10 px-6 py-12">
        <div className="w-full max-w-md bg-background/80 backdrop-blur-md p-8 rounded-2xl shadow-lg space-y-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold">Get started</h2>
            <p className="text-muted-foreground">
              Create your account to continue
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" {...register("username")} placeholder="Your Name" />
              {errors.username && (
                <p className="text-red-500 text-sm">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} placeholder="you@example.com" />
              {errors.email && (
                <p className="text-red-500 text-sm">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register("password")} placeholder="••••••••" />
              {errors.password && (
                <p className="text-red-500 text-sm">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...register("confirmPassword")}
                placeholder="••••••••"
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}
            {success && <p className="text-green-600 text-sm">{success}</p>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing up..." : "Sign up"}
            </Button>
          </form>

          <div className="pt-4 border-t text-center space-y-3">
            <p className="text-sm text-muted-foreground">Or continue with</p>
            <GithubLoginButton onClick={signInWithGitHub} />
          </div>

          <div className="text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="underline hover:text-primary">
              Sign In Now
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
