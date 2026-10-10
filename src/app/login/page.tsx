// app/login/page.tsx

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { signInSchema } from "@/lib/authSchema";
import { AuthError, resendVerificationEmail, signInWithEmail } from "@/lib/auth-client";
import { AuthShell } from "@/components/auth/AuthShell";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";

type LoginFormData = z.infer<typeof signInSchema>;

export default function LoginPage() {
  const router = useRouter();

  // Set when the account's email isn't confirmed yet (a new link was sent)
  const [unverified, setUnverified] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setUnverified(null);
    try {
      await signInWithEmail(data.email, data.password);
      toast.success("Logged in successfully");
      router.push("/dashboard");
    } catch (error: unknown) {
      if (error instanceof AuthError && error.code === "EMAIL_NOT_VERIFIED") {
        // Better Auth has just sent a fresh confirmation link
        setUnverified(data.email);
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("An unexpected error occurred.");
      }
    }
  };

  const resend = async () => {
    if (!unverified) return;
    setResending(true);
    try {
      await resendVerificationEmail(unverified);
      toast.success("Sent another confirmation link");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the email");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      seed={11}
      tagline="Welcome back to your nest."
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} placeholder="you@example.com" />
          {errors.email && (
            <p className="text-red-500 text-sm">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" {...register("password")} placeholder="••••••••" />
          {errors.password && (
            <p className="text-red-500 text-sm">{errors.password.message}</p>
          )}
        </div>

        {unverified && (
          <div role="alert" className="space-y-2 rounded-md border bg-leaf-soft/60 p-3 text-sm">
            <p>
              Please confirm your email first. We&apos;ve sent a new link to <strong>{unverified}</strong>.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={resend} disabled={resending}>
              {resending ? "Sending…" : "Send it again"}
            </Button>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <SocialLoginButtons />

      <div className="text-center text-sm">
        New to Nestery?{" "}
        <Link href="/signup" className="font-medium text-leaf underline-offset-4 hover:underline">
          Create an account
        </Link>
      </div>
    </AuthShell>
  );
}
