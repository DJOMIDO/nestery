// app/forgot-password/page.tsx
"use client";

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) return setError("Enter the email you signed up with");
    setError(null);
    setSending(true);
    try {
      await requestPasswordReset(address);
      setSentTo(address);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthShell
      seed={31}
      tagline="Back to your nest in a moment."
      title={sentTo ? "Check your inbox" : "Forgot your password?"}
      subtitle={sentTo ? "Follow the link to choose a new password." : "We'll email you a link to choose a new one."}
    >
      {sentTo ? (
        <div className="space-y-4 text-sm">
          {/* Same answer whether or not the account exists */}
          <p>
            If there&apos;s a Nestery account for <strong>{sentTo}</strong>, a link to reset the password is on its
            way. It works for 1 hour.
          </p>
          <p className="text-muted-foreground">Nothing there after a few minutes? Check your spam folder.</p>
          <Button variant="outline" asChild>
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={sending}>
            {sending && <Spinner />}
            {sending ? "Sending…" : "Send reset link"}
          </Button>
          <p className="text-center text-sm">
            Remembered it?{" "}
            <Link href="/login" className="font-medium text-leaf underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
