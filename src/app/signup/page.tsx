// app/signup/page.tsx

"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuthErrorText } from "@/components/auth/useAuthErrorText";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";

import { signUpSchema } from "@/lib/authSchema";
import { resendVerificationEmail, signUpWithEmail } from "@/lib/auth-client";

import { AuthShell } from "@/components/auth/AuthShell";
import { SocialLoginButtons } from "@/components/auth/SocialLoginButtons";
import { toast } from "sonner";

import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

type FormData = z.infer<ReturnType<typeof signUpSchema>>;

export default function SignupPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const tValidation = useTranslations("auth.validation");
  const errorText = useAuthErrorText();
  const schema = useMemo(() => signUpSchema(tValidation), [tValidation]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
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
      toast.success(t("signup.created"));
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(errorText(err));
    }
  };

  const resend = async () => {
    if (!sentTo) return;
    setResending(true);
    try {
      await resendVerificationEmail(sentTo);
      toast.success(t("resent"));
    } catch (err) {
      toast.error(err instanceof Error ? errorText(err) : t("couldNotSend"));
    } finally {
      setResending(false);
    }
  };

  if (sentTo) {
    return (
      <AuthShell
        seed={23}
        tagline={t("signup.tagline")}
        title={t("signup.checkInbox")}
        subtitle={t("signup.oneMore")}
      >
        <div className="space-y-4 text-sm">
          <p>
            {t.rich("signup.sent", { email: sentTo, b: (chunks) => <strong>{chunks}</strong> })}
          </p>
          <p className="text-muted-foreground">
            {t("signup.spam")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={resend} disabled={resending}>
              {resending && <Spinner />}
              {resending ? tCommon("sending") : t("sendAgain")}
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/login">{t("backToSignIn")}</Link>
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      seed={23}
      tagline={t("signup.tagline")}
      title={t("signup.title")}
      subtitle={t("signup.subtitle")}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">{t("signup.username")}</Label>
          <Input id="username" {...register("username")} placeholder={t("signup.usernamePlaceholder")} />
          {errors.username && (
            <p className="text-red-500 text-sm">
              {errors.username.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{tCommon("email")}</Label>
          <Input id="email" type="email" {...register("email")} placeholder={t("emailPlaceholder")} />
          {errors.email && (
            <p className="text-red-500 text-sm">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{tCommon("password")}</Label>
          <Input id="password" type="password" {...register("password")} placeholder="••••••••" />
          {errors.password && (
            <p className="text-red-500 text-sm">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t("signup.confirm")}</Label>
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
          {isSubmitting ? t("signup.signingUp") : t("signup.signUp")}
        </Button>
      </form>

      <SocialLoginButtons />

      <div className="text-center text-sm">
        {t.rich("signup.haveAccount", {
          link: (chunks) => (
            <Link href="/login" className="font-medium text-leaf underline-offset-4 hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </div>
    </AuthShell>
  );
}
