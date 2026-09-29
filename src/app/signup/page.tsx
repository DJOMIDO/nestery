// app/signup/page.tsx

"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

import { signUpSchema } from "@/lib/authSchema";
import { resendVerificationEmail, signUpWithEmail, signInWithGitHub } from "@/lib/auth-client";

import { GithubLoginButton } from "@/components/GithubLoginButton";
import { AuthShell } from "@/components/auth/AuthShell";
import { useSocialProviders } from "@/components/auth/SocialProviders";
import { toast } from "sonner";

import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

type FormData = z.infer<typeof signUpSchema>;

export default function SignupPage() {
  const providers = useSocialProviders();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(signUpSchema),
  });

  // Set when the account needs its email confirmed before signing in
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const onSubmit = async (data: FormData) => {
    try {
      const result = await signUpWithEmail(data.email, data.password, data.username);
      // No session yet: the confirmation link in the email signs them in
      if (!result?.token) {
        setSentTo(data.email);
        return;
      }
      toast.success("Account created successfully");
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error("Something went wrong.");
      }
    }
  };

  const resend = async () => {
    if (!sentTo) return;
    setResending(true);
    try {
      await resendVerificationEmail(sentTo);
      toast.success("Sent another confirmation link");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the email");
    } finally {
      setResending(false);
    }
  };

  if (sentTo) {
    return (
      <AuthShell
        seed={23}
        tagline="Make yourself at home."
        title="Check your inbox"
        subtitle="One more step to finish creating your account."
      >
        <div className="space-y-4 text-sm">
          <p>
            We&apos;ve sent a confirmation link to <strong>{sentTo}</strong>. Open it to confirm your email and
            you&apos;ll be signed in.
          </p>
          <p className="text-muted-foreground">
            Nothing there after a few minutes? Check your spam folder, or send the link again.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={resend} disabled={resending}>
              {resending ? "Sending…" : "Send it again"}
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/login">Back to sign in</Link>
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      seed={23}
      tagline="Make yourself at home."
      title="Create your account"
      subtitle="Your tasks and notes, all in one place."
    >
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

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing up..." : "Sign up"}
        </Button>
      </form>

      {/* Only when GitHub sign-in is configured on the server */}
      {providers.includes("github") && (
        <div className="pt-4 border-t text-center space-y-3">
          <p className="text-sm text-muted-foreground">Or continue with</p>
          <GithubLoginButton onClick={signInWithGitHub} />
        </div>
      )}

      <div className="text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-leaf underline-offset-4 hover:underline">
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
}
