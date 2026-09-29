// src/components/settings/AccountSettings.tsx
// Settings > Account: profile, password, sign-in methods, devices, deletion.
// Everything goes through Better Auth's client; the server enforces the rules
// (current password, rate limits, keeping at least one sign-in method).

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Github, KeyRound, Laptop, LogOut, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormat } from "@/components/SettingsProvider";
import { request } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { formatRelative } from "@/lib/tasks";

// Better Auth client calls resolve to { data, error }; this throws the error
// so callers can use try/catch
async function call<T>(promise: Promise<{ data: T; error: { message?: string } | null }>) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message || "Something went wrong");
  return data;
}

// Unlinking and deleting need a recent sign-in; say so plainly
const errorMessage = (err: unknown) => {
  const message = err instanceof Error ? err.message : "Something went wrong";
  return /fresh|session/i.test(message)
    ? "For your security, sign out and sign in again, then try once more."
    : message;
};

interface LinkedAccount {
  // Better Auth's own id for the linked account (what unlinking takes)
  id: string;
  providerId: string;
}

export function AccountSettings() {
  const { data: session, isPending } = authClient.useSession();
  const [accounts, setAccounts] = useState<LinkedAccount[] | null>(null);
  const [providers, setProviders] = useState<string[]>([]);

  const loadAccounts = useCallback(async () => {
    try {
      setAccounts(await call(authClient.listAccounts()));
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    loadAccounts();
    request<string[]>("/api/account/providers").then(setProviders).catch(() => setProviders([]));
  }, [loadAccounts]);

  if (isPending || !session) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const hasPassword = accounts?.some((a) => a.providerId === "credential") ?? false;

  return (
    <div className="space-y-6">
      <ProfileCard name={session.user.name} email={session.user.email} />
      <PasswordCard hasPassword={hasPassword} loading={accounts === null} />
      <SignInMethodsCard accounts={accounts} providers={providers} onChange={loadAccounts} />
      <SessionsCard currentToken={session.session.token} />
      <DeleteAccountCard email={session.user.email} hasPassword={hasPassword} />
    </div>
  );
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

// ---- Profile -------------------------------------------------------------

function ProfileCard({ name, email }: { name: string; email: string }) {
  const [value, setValue] = useState(name);
  const [changingEmail, setChangingEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const trimmed = value.trim();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trimmed.length < 2) return toast.error("Your name needs at least 2 characters");
    setSaving(true);
    try {
      // Updates the session too, so the sidebar and greeting change right away
      await call(authClient.updateUser({ name: trimmed }));
      toast.success("Name updated");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Profile">
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="account-name">Name</Label>
          <Input id="account-name" value={value} onChange={(e) => setValue(e.target.value)} maxLength={60} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-email">Email</Label>
          {/* Read-only (not disabled, which looks broken); changing goes through
              email confirmation, started with the button */}
          <div className="flex gap-2">
            <Input
              id="account-email"
              value={email}
              readOnly
              aria-describedby="account-email-hint"
              className="bg-muted/40 text-foreground focus-visible:ring-0"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => setChangingEmail((v) => !v)}
              aria-expanded={changingEmail}
              className="shrink-0"
            >
              {changingEmail ? "Cancel" : "Change email"}
            </Button>
          </div>
          <p id="account-email-hint" className="text-xs text-muted-foreground">
            Changing it needs a confirmation from your current and your new address.
          </p>
        </div>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" disabled={saving || trimmed === name || trimmed.length < 2}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
      {changingEmail && <ChangeEmailForm currentEmail={email} onDone={() => setChangingEmail(false)} />}
    </Card>
  );
}

// The current address approves the change by email, then the new one is
// confirmed; only then does the account's email change
function ChangeEmailForm({ currentEmail, onDone }: { currentEmail: string; onDone: () => void }) {
  const [newEmail, setNewEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = newEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) return setError("Enter a valid email address");
    if (address.toLowerCase() === currentEmail.toLowerCase()) return setError("That's already your email");
    setError(null);
    setSending(true);
    try {
      await call(authClient.changeEmail({ newEmail: address, callbackURL: "/settings?section=account" }));
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="space-y-3 rounded-md border bg-leaf-soft/50 p-3 text-sm">
        <p>
          Check <strong>{currentEmail}</strong> and approve the change. We&apos;ll then send a link to{" "}
          <strong>{newEmail.trim()}</strong>; your email changes once you open it.
        </p>
        <Button variant="outline" size="sm" onClick={onDone}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border p-3">
      <div className="space-y-2 sm:max-w-sm">
        <Label htmlFor="new-email">New email</Label>
        <Input
          id="new-email"
          type="email"
          autoComplete="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={sending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={sending || !newEmail.trim()}>
          {sending ? "Sending…" : "Send confirmation"}
        </Button>
      </div>
    </form>
  );
}

// ---- Password ------------------------------------------------------------

function PasswordCard({ hasPassword, loading }: { hasPassword: boolean; loading: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (loading) return null;
  if (!hasPassword) {
    return (
      <Card title="Password">
        <p className="text-sm text-muted-foreground">
          You sign in with GitHub, so your account has no password to change.
        </p>
      </Card>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setError("The new password needs at least 8 characters");
    if (next !== confirm) return setError("The new passwords don't match");
    setError(null);
    setSaving(true);
    try {
      await call(
        authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: signOutOthers })
      );
      toast.success(signOutOthers ? "Password changed; other devices were signed out" : "Password changed");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Password">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2 sm:max-w-sm">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        </div>
        <label className="flex w-fit items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={signOutOthers}
            onChange={(e) => setSignOutOthers(e.target.checked)}
            className="size-4 accent-leaf"
          />
          Sign out of my other devices
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !current || !next || !confirm}>
            {saving ? "Changing…" : "Change password"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ---- Sign-in methods -----------------------------------------------------

function SignInMethodsCard({
  accounts,
  providers,
  onChange,
}: {
  accounts: LinkedAccount[] | null;
  providers: string[];
  onChange: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  if (!accounts) return null;

  const hasPassword = accounts.some((a) => a.providerId === "credential");
  const github = accounts.find((a) => a.providerId === "github");
  const hasGithub = !!github;
  // Never remove the last way to sign in
  const canUnlink = accounts.length > 1;

  const connectGithub = async () => {
    setBusy(true);
    try {
      // Leaves for GitHub and comes back here when done
      await call(authClient.linkSocial({ provider: "github", callbackURL: "/settings?section=account" }));
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  };

  const disconnectGithub = async () => {
    setBusy(true);
    try {
      await call(authClient.unlinkAccount({ accountId: github!.id }));
      toast.success("GitHub disconnected");
      await onChange();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Sign-in methods" description="Ways you can sign in to Nestery.">
      <ul className="divide-y rounded-md border">
        <li className="flex items-center gap-3 p-3">
          <KeyRound className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-sm">Email and password</span>
          <span className="text-xs text-muted-foreground">{hasPassword ? "Connected" : "Not set up"}</span>
        </li>
        {(hasGithub || providers.includes("github")) && (
          <li className="flex items-center gap-3 p-3">
            <Github className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm">GitHub</span>
            {hasGithub ? (
              <Button
                variant="outline"
                size="sm"
                onClick={disconnectGithub}
                disabled={busy || !canUnlink}
                title={canUnlink ? undefined : "It's your only way to sign in"}
              >
                Disconnect
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={connectGithub} disabled={busy}>
                Connect
              </Button>
            )}
          </li>
        )}
      </ul>
      {!canUnlink && hasGithub && (
        <p className="text-xs text-muted-foreground">
          GitHub is your only way to sign in, so it can&apos;t be disconnected.
        </p>
      )}
    </Card>
  );
}

// ---- Devices -------------------------------------------------------------

interface SessionInfo {
  id: string;
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// "Chrome on macOS" from a user agent string (good enough to tell devices apart)
function describeDevice(userAgent?: string | null) {
  if (!userAgent) return { label: "Unknown device", mobile: false };
  const ua = userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /iPhone|iPad/.test(ua)
    ? /iPad/.test(ua) ? "iPad" : "iPhone"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "unknown system";
  return { label: `${browser} on ${os}`, mobile: /iPhone|Android|Mobile/.test(ua) };
}

function SessionsCard({ currentToken }: { currentToken: string }) {
  const format = useFormat();
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = (await call(authClient.listSessions())) ?? [];
      // Current device first, then most recently active
      setSessions(
        [...list].sort(
          (a, b) =>
            Number(b.token === currentToken) - Number(a.token === currentToken) ||
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
      );
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }, [currentToken]);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (token: string) => {
    setBusy(true);
    try {
      await call(authClient.revokeSession({ token }));
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const revokeOthers = async () => {
    setBusy(true);
    try {
      await call(authClient.revokeOtherSessions());
      toast.success("Signed out of your other devices");
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const others = sessions?.filter((s) => s.token !== currentToken).length ?? 0;

  return (
    <Card title="Devices" description="Where you're signed in.">
      {!sessions ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {sessions.map((s) => {
            const { label, mobile } = describeDevice(s.userAgent);
            const Icon = mobile ? Smartphone : Laptop;
            const current = s.token === currentToken;
            return (
              <li key={s.id} className="flex items-center gap-3 p-3">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    {label}
                    {current && <span className="ml-2 text-xs font-medium text-leaf">This device</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Active {formatRelative(new Date(s.updatedAt).toISOString(), undefined, format.day)}
                    {s.ipAddress && ` · ${s.ipAddress}`}
                  </p>
                </div>
                {!current && (
                  <Button variant="ghost" size="sm" onClick={() => revoke(s.token)} disabled={busy}>
                    Sign out
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {others > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={revokeOthers} disabled={busy}>
            <LogOut className="size-4 mr-1" /> Sign out of all other devices
          </Button>
        </div>
      )}
    </Card>
  );
}

// ---- Delete account ------------------------------------------------------

function DeleteAccountCard({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typedEmail, setTypedEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmed = typedEmail.trim().toLowerCase() === email.toLowerCase() && (!hasPassword || password.length > 0);

  const remove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) return;
    setError(null);
    setDeleting(true);
    try {
      // Without a password (GitHub-only accounts) Better Auth requires a
      // recent sign-in instead
      await call(authClient.deleteUser(hasPassword ? { password } : {}));
      toast("Your account was deleted");
      router.replace("/");
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <section className="space-y-4 rounded-lg border border-destructive/40 bg-card p-5">
      <div>
        <h2 className="font-semibold text-destructive">Delete account</h2>
        <p className="text-sm text-muted-foreground">
          Permanently deletes your account and everything in it: tasks, notes, events, calendar subscriptions and
          settings. This can&apos;t be undone.
        </p>
      </div>

      {!open ? (
        <Button variant="outline" className="border-destructive/40 text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
          <Trash2 className="size-4 mr-1" /> Delete my account
        </Button>
      ) : (
        <form onSubmit={remove} className="space-y-4">
          <div className="space-y-2 sm:max-w-sm">
            <Label htmlFor="delete-email">
              Type your email, <span className="font-medium">{email}</span>, to confirm
            </Label>
            <Input
              id="delete-email"
              value={typedEmail}
              onChange={(e) => setTypedEmail(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {hasPassword && (
            <div className="space-y-2 sm:max-w-sm">
              <Label htmlFor="delete-password">Password</Label>
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!confirmed || deleting}>
              {deleting ? "Deleting…" : "Delete account forever"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
