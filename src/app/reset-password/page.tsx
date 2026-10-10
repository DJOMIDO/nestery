// app/reset-password/page.tsx
"use client";

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters");
    if (password !== confirm) return setError("The passwords don't match");
    setError(null);
    setSaving(true);
    try {
      await resetPassword(token!, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const shell = (title: string, subtitle: string, children: React.ReactNode) => (
    <AuthShell seed={37} tagline="Back to your nest in a moment." title={title} subtitle={subtitle}>
      {children}
    </AuthShell>
  );

  if (!token || linkError) {
    return shell(
      "This link doesn't work",
      "Reset links work once, for 1 hour.",
      <div className="space-y-4 text-sm">
        <p>The link has expired or was already used. Ask for a new one and use the latest email.</p>
        <Button asChild>
          <Link href="/forgot-password">Send a new link</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return shell(
      "Password changed",
      "You can sign in with your new password.",
      <div className="space-y-4 text-sm">
        <p>For your security, any other devices signed in to your account have been signed out.</p>
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return shell(
    "Choose a new password",
    "Use at least 8 characters.",
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm new password</Label>
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
        {saving ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
