// app/login/page.tsx

"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { signInSchema } from "@/lib/authSchema";
import { AuthError, resendVerificationEmail, signInWithEmail } from "@/lib/auth-client";
import { AuthShell } from "@/components/auth/AuthShell";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { useAuthErrorText } from "@/components/auth/useAuthErrorText";

type LoginFormData = z.infer<ReturnType<typeof signInSchema>>;

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("auth.validation");
  const errorText = useAuthErrorText();
  const schema = useMemo(() => signInSchema(tValidation), [tValidation]);

  // Set when the account's email isn't confirmed yet (a new link was sent)
  const [unverified, setUnverified] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setUnverified(null);
    try {
      await signInWithEmail(data.email, data.password);
      toast.success(t("login.success"));
      router.push("/dashboard");
    } catch (error: unknown) {
      if (error instanceof AuthError && error.code === "EMAIL_NOT_VERIFIED") {
        // Better Auth has just sent a fresh confirmation link
        setUnverified(data.email);
      } else {
        toast.error(errorText(error));
      }
    }
  };

  const resend = async () => {
    if (!unverified) return;
    setResending(true);
    try {
      await resendVerificationEmail(unverified);
      toast.success(t("resent"));
    } catch (error) {
      toast.error(error instanceof Error ? errorText(error) : t("couldNotSend"));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      seed={11}
      tagline={t("login.tagline")}
      title={t("login.title")}
      subtitle={t("login.subtitle")}
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="email">{tCommon("email")}</Label>
          <Input id="email" type="email" {...register("email")} placeholder={t("emailPlaceholder")} />
          {errors.email && (
            <p className="text-red-500 text-sm">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{tCommon("password")}</Label>
            <Link href="/forgot-password" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              {t("login.forgot")}
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
              {t.rich("login.unverified", { email: unverified, b: (chunks) => <strong>{chunks}</strong> })}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={resend} disabled={resending}>
              {resending && <Spinner />}
              {resending ? tCommon("sending") : t("sendAgain")}
            </Button>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t("login.signingIn") : t("signIn")}
        </Button>
      </form>

      <SocialLoginButtons />

      <div className="text-center text-sm">
        {t.rich("login.new", {
          link: (chunks) => (
            <Link href="/signup" className="font-medium text-leaf underline-offset-4 hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </div>
    </AuthShell>
  );
}
