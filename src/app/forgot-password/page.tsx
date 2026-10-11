// app/forgot-password/page.tsx
"use client";

import { useTranslations } from "next-intl";
import { useAuthErrorText } from "@/components/auth/useAuthErrorText";
import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const errorText = useAuthErrorText();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) return setError(t("forgot.enterEmail"));
    setError(null);
    setSending(true);
    try {
      await requestPasswordReset(address);
      setSentTo(address);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthShell
      seed={31}
      tagline={t("forgot.tagline")}
      title={sentTo ? t("signup.checkInbox") : t("forgot.title")}
      subtitle={sentTo ? t("forgot.sentSubtitle") : t("forgot.subtitle")}
    >
      {sentTo ? (
        <div className="space-y-4 text-sm">
          {/* Same answer whether or not the account exists */}
          <p>
            {t.rich("forgot.sent", { email: sentTo, b: (chunks) => <strong>{chunks}</strong> })}
          </p>
          <p className="text-muted-foreground">{t("forgot.spam")}</p>
          <Button variant="outline" asChild>
            <Link href="/login">{t("backToSignIn")}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{tCommon("email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={sending}>
            {sending && <Spinner />}
            {sending ? tCommon("sending") : t("forgot.send")}
          </Button>
          <p className="text-center text-sm">
            {t.rich("forgot.remembered", {
              link: (chunks) => (
                <Link href="/login" className="font-medium text-leaf underline-offset-4 hover:underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </form>
      )}
    </AuthShell>
  );
}
