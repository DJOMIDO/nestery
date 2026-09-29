// app/signup/page.tsx

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

import { signUpSchema } from "@/lib/authSchema";
import { signUpWithEmail, signInWithGitHub } from "@/lib/auth-client";

import { GithubLoginButton } from "@/components/GithubLoginButton";
import { AuthShell } from "@/components/auth/AuthShell";
import { toast } from "sonner";

import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

type FormData = z.infer<typeof signUpSchema>;

export default function SignupPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(signUpSchema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await signUpWithEmail(data.email, data.password, data.username);
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

      <div className="pt-4 border-t text-center space-y-3">
        <p className="text-sm text-muted-foreground">Or continue with</p>
        <GithubLoginButton onClick={signInWithGitHub} />
      </div>

      <div className="text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-leaf underline-offset-4 hover:underline">
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
}
