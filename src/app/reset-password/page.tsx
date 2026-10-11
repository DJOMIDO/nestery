// app/reset-password/page.tsx
"use client";

import { useTranslations } from "next-intl";
import { useAuthErrorText } from "@/components/auth/useAuthErrorText";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/auth-client";

// The link in the reset email lands here with ?token=… (or ?error=INVALID_TOKEN
// when it expired or was already used). useSearchParams needs Suspense.
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const errorText = useAuthErrorText();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError(t("reset.tooShort"));
    if (password !== confirm) return setError(t("reset.mismatch"));
    setError(null);
    setSaving(true);
    try {
      await resetPassword(token!, password);
      setDone(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const shell = (title: string, subtitle: string, children: React.ReactNode) => (
    <AuthShell seed={37} tagline={t("forgot.tagline")} title={title} subtitle={subtitle}>
      {children}
    </AuthShell>
  );

  if (!token || linkError) {
    return shell(
      t("reset.badLink"),
      t("reset.badLinkSubtitle"),
      <div className="space-y-4 text-sm">
        <p>{t("reset.badLinkText")}</p>
        <Button asChild>
          <Link href="/forgot-password">{t("reset.newLink")}</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return shell(
      t("reset.done"),
      t("reset.doneSubtitle"),
      <div className="space-y-4 text-sm">
        <p>{t("reset.doneText")}</p>
        <Button asChild>
          <Link href="/login">{t("signIn")}</Link>
        </Button>
      </div>
    );
  }

  return shell(
    t("reset.title"),
    t("reset.subtitle"),
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">{t("reset.new")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">{t("reset.confirm")}</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={saving || !password || !confirm}>
        {saving && <Spinner />}
        {saving ? tCommon("saving") : t("reset.change")}
      </Button>
    </form>
  );
}
