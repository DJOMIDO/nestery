// app/login/page.tsx

"use client";

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
import { signInWithEmail, signInWithGitHub } from "@/lib/auth-client";
import { GithubLoginButton } from "@/components/GithubLoginButton";
import { AuthShell } from "@/components/auth/AuthShell";

type LoginFormData = z.infer<typeof signInSchema>;

export default function LoginPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await signInWithEmail(data.email, data.password);
      toast.success("Logged in successfully");
      router.push("/dashboard");
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("An unexpected error occurred.");
      }
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
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" {...register("password")} placeholder="••••••••" />
          {errors.password && (
            <p className="text-red-500 text-sm">{errors.password.message}</p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <div className="pt-4 border-t text-center space-y-3">
        <p className="text-sm text-muted-foreground">Or continue with</p>
        <GithubLoginButton onClick={signInWithGitHub} />
      </div>

      <div className="text-center text-sm">
        New to Nestery?{" "}
        <Link href="/signup" className="font-medium text-leaf underline-offset-4 hover:underline">
          Create an account
        </Link>
      </div>
    </AuthShell>
  );
}
