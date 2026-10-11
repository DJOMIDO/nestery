// src/components/settings/AccountSettings.tsx
// Settings > Account: profile, password, sign-in methods, devices, deletion.
// Everything goes through Better Auth's client; the server enforces the rules
// (current password, rate limits, keeping at least one sign-in method).

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { KeyRound, Laptop, LogOut, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loading, Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormat } from "@/components/SettingsProvider";
import { request } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { ProviderIcon } from "@/components/auth/ProviderIcon";
import {
  SOCIAL_PROVIDERS,
  SOCIAL_PROVIDER_LABELS,
  isSocialProvider,
  type SocialProviderId,
} from "@/lib/socialProviders";

// Better Auth client calls resolve to { data, error }; this throws the error
// so callers can use try/catch
async function call<T>(promise: Promise<{ data: T; error: { message?: string } | null }>) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message || "");
  return data;
}

// The message to show for a failed call. Unlinking and deleting need a
// recent sign-in; say so plainly.
function useErrorMessage() {
  const t = useTranslations();
  return (err: unknown) => {
    const message = err instanceof Error ? err.message : "";
    if (/fresh|session/i.test(message)) return t("account.reauth");
    return message || t("common.somethingWrong");
  };
}

interface LinkedAccount {
  // Better Auth's own id for the linked account (what unlinking takes)
  id: string;
  providerId: string;
}

export function AccountSettings() {
  const { data: session, isPending } = authClient.useSession();
  const [accounts, setAccounts] = useState<LinkedAccount[] | null>(null);
  const [providers, setProviders] = useState<SocialProviderId[]>([]);
  const errorMessage = useErrorMessage();
  const locale = useLocale();

  const loadAccounts = useCallback(async () => {
    try {
      setAccounts(await call(authClient.listAccounts()));
    } catch (err) {
      toast.error(errorMessage(err));
    }
    // errorMessage changes only with the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAccounts();
    request<SocialProviderId[]>("/api/account/providers").then(setProviders).catch(() => setProviders([]));
  }, [loadAccounts]);

  if (isPending || !session) return <Loading />;

  const hasPassword = accounts?.some((a) => a.providerId === "credential") ?? false;
  // e.g. "GitHub" or "GitHub and Google", for accounts without a password
  const socialNames = new Intl.ListFormat(locale, { type: "conjunction" }).format(
    (accounts ?? []).map((a) => a.providerId).filter(isSocialProvider).map((p) => SOCIAL_PROVIDER_LABELS[p])
  );

  return (
    <div className="space-y-6">
      <ProfileCard name={session.user.name} email={session.user.email} />
      <PasswordCard hasPassword={hasPassword} socialNames={socialNames} loading={accounts === null} />
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
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const trimmed = value.trim();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trimmed.length < 2) return toast.error(t("profile.nameTooShort"));
    setSaving(true);
    try {
      // Updates the session too, so the sidebar and greeting change right away
      await call(authClient.updateUser({ name: trimmed }));
      toast.success(t("profile.nameUpdated"));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={t("profile.title")}>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="account-name">{t("profile.name")}</Label>
          <Input id="account-name" value={value} onChange={(e) => setValue(e.target.value)} maxLength={60} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-email">{tCommon("email")}</Label>
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
              {changingEmail ? tCommon("cancel") : t("profile.changeEmail")}
            </Button>
          </div>
          <p id="account-email-hint" className="text-xs text-muted-foreground">
            {t("profile.emailHint")}
          </p>
        </div>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" disabled={saving || trimmed === name || trimmed.length < 2}>
            {saving && <Spinner />}
            {saving ? tCommon("saving") : tCommon("save")}
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
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = newEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(address)) return setError(t("email.invalid"));
    if (address.toLowerCase() === currentEmail.toLowerCase()) return setError(t("email.same"));
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
          {t.rich("email.sent", {
            current: currentEmail,
            next: newEmail.trim(),
            b: (chunks) => <strong>{chunks}</strong>,
          })}
        </p>
        <Button variant="outline" size="sm" onClick={onDone}>
          {tCommon("done")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border p-3">
      <div className="space-y-2 sm:max-w-sm">
        <Label htmlFor="new-email">{t("email.new")}</Label>
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
          {tCommon("cancel")}
        </Button>
        <Button type="submit" size="sm" disabled={sending || !newEmail.trim()}>
          {sending && <Spinner />}
          {sending ? tCommon("sending") : t("email.send")}
        </Button>
      </div>
    </form>
  );
}

// ---- Password ------------------------------------------------------------

function PasswordCard({
  hasPassword,
  socialNames,
  loading,
}: {
  hasPassword: boolean;
  socialNames: string;
  loading: boolean;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [signOutOthers, setSignOutOthers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();

  if (loading) return null;
  if (!hasPassword) {
    return (
      <Card title={tCommon("password")}>
        <p className="text-sm text-muted-foreground">{t("password.noPassword", { methods: socialNames })}</p>
      </Card>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setError(t("password.tooShort"));
    if (next !== confirm) return setError(t("password.mismatch"));
    setError(null);
    setSaving(true);
    try {
      await call(
        authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: signOutOthers })
      );
      toast.success(signOutOthers ? t("password.changedSignedOut") : t("password.changed"));
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
    <Card title={tCommon("password")}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2 sm:max-w-sm">
          <Label htmlFor="current-password">{t("password.current")}</Label>
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
            <Label htmlFor="new-password">{t("password.new")}</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder={t("password.newPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t("password.confirm")}</Label>
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
          {t("password.signOutOthers")}
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !current || !next || !confirm}>
            {saving ? t("password.changing") : t("password.change")}
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
  providers: SocialProviderId[];
  onChange: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const t = useTranslations("account.methods");
  const errorMessage = useErrorMessage();
  if (!accounts) return null;

  const hasPassword = accounts.some((a) => a.providerId === "credential");
  const linked = (provider: SocialProviderId) => accounts.find((a) => a.providerId === provider);
  // Linked ones stay listed even if the provider was switched off since, so
  // they can still be disconnected
  const shown = SOCIAL_PROVIDERS.filter((p) => linked(p) || providers.includes(p));
  // Never remove the last way to sign in
  const canUnlink = accounts.length > 1;
  const onlyMethod = !canUnlink ? shown.find((p) => linked(p)) : undefined;

  const connect = async (provider: SocialProviderId) => {
    setBusy(true);
    try {
      // Leaves for the provider and comes back here when done
      await call(authClient.linkSocial({ provider, callbackURL: "/settings?section=account" }));
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  };

  const disconnect = async (account: LinkedAccount, provider: SocialProviderId) => {
    setBusy(true);
    try {
      await call(authClient.unlinkAccount({ accountId: account.id }));
      toast.success(t("disconnected", { provider: SOCIAL_PROVIDER_LABELS[provider] }));
      await onChange();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t("title")} description={t("description")}>
      <ul className="divide-y rounded-md border">
        <li className="flex items-center gap-3 p-3">
          <KeyRound className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-sm">{t("emailPassword")}</span>
          <span className="text-xs text-muted-foreground">{hasPassword ? t("connected") : t("notSetUp")}</span>
        </li>
        {shown.map((provider) => {
          const account = linked(provider);
          return (
            <li key={provider} className="flex items-center gap-3 p-3">
              <ProviderIcon provider={provider} className={provider === "github" ? "text-muted-foreground" : undefined} />
              <span className="flex-1 text-sm">{SOCIAL_PROVIDER_LABELS[provider]}</span>
              {account ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnect(account, provider)}
                  disabled={busy || !canUnlink}
                  title={canUnlink ? undefined : t("onlyWayShort")}
                >
                  {t("disconnect")}
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => connect(provider)} disabled={busy}>
                  {t("connect")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {onlyMethod && (
        <p className="text-xs text-muted-foreground">
          {t("onlyWay", { provider: SOCIAL_PROVIDER_LABELS[onlyMethod] })}
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

type DevicesT = ReturnType<typeof useTranslations<"account.devices">>;

// An IP as people write it: IPv6 shortened ("2001:db8::1"), and the
// addresses a local dev server records ("0000:…:0000", "::1", 127.0.0.1)
// shown as "Local"
function formatIp(ip: string, t: DevicesT) {
  if (!ip.includes(":")) return ip.startsWith("127.") ? t("local") : ip;
  const groups = ip.split(":").map((g) => g.replace(/^0+(?=.)/, "").toLowerCase());
  // Collapse the longest run of zero groups into "::"
  let best = { start: -1, length: 0 };
  for (let i = 0; i < groups.length; ) {
    let j = i;
    while (j < groups.length && groups[j] === "0") j++;
    if (j - i > best.length) best = { start: i, length: j - i };
    i = j === i ? i + 1 : j;
  }
  const short =
    best.length > 1
      ? `${groups.slice(0, best.start).join(":")}::${groups.slice(best.start + best.length).join(":")}`
      : groups.join(":");
  return short === "::" || short === "::1" ? t("local") : short;
}

// "Chrome on macOS" from a user agent string (good enough to tell devices apart)
function describeDevice(userAgent: string | null | undefined, t: DevicesT) {
  if (!userAgent) return { label: t("unknown"), mobile: false };
  const ua = userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : t("browser");
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
            : t("unknownSystem");
  return { label: t("on", { browser, os }), mobile: /iPhone|Android|Mobile/.test(ua) };
}

function SessionsCard({ currentToken }: { currentToken: string }) {
  const format = useFormat();
  const t = useTranslations("account.devices");
  const errorMessage = useErrorMessage();
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
    // errorMessage changes only with the language
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      toast.success(t("signedOutOthers"));
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const others = sessions?.filter((s) => s.token !== currentToken).length ?? 0;

  return (
    <Card title={t("title")} description={t("description")}>
      {!sessions ? (
        <Loading />
      ) : (
        <ul className="divide-y rounded-md border">
          {sessions.map((s) => {
            const { label, mobile } = describeDevice(s.userAgent, t);
            const Icon = mobile ? Smartphone : Laptop;
            const current = s.token === currentToken;
            return (
              <li key={s.id} className="flex items-center gap-3 p-3">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    {label}
                    {current && <span className="ml-2 text-xs font-medium text-leaf">{t("thisDevice")}</span>}
                  </p>
                  {/* A long address wraps rather than running past the card */}
                  <p className="text-xs text-muted-foreground wrap-anywhere">
                    {t("active", { time: format.relative(new Date(s.updatedAt).toISOString()) })}
                    {s.ipAddress && ` · ${formatIp(s.ipAddress, t)}`}
                  </p>
                </div>
                {!current && (
                  <Button variant="ghost" size="sm" onClick={() => revoke(s.token)} disabled={busy}>
                    {t("signOut")}
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
            <LogOut className="size-4 mr-1" /> {t("signOutAll")}
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
  const t = useTranslations("account.delete");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();

  const confirmed = typedEmail.trim().toLowerCase() === email.toLowerCase() && (!hasPassword || password.length > 0);

  const remove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) return;
    setError(null);
    setDeleting(true);
    try {
      // Without a password (GitHub or Google only accounts) Better Auth requires a
      // recent sign-in instead
      await call(authClient.deleteUser(hasPassword ? { password } : {}));
      toast(t("done"));
      router.replace("/");
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <section className="space-y-4 rounded-lg border border-destructive/40 bg-card p-5">
      <div>
        <h2 className="font-semibold text-destructive">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {!open ? (
        <Button variant="outline" className="border-destructive/40 text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
          <Trash2 className="size-4 mr-1" /> {t("open")}
        </Button>
      ) : (
        <form onSubmit={remove} className="space-y-4">
          <div className="space-y-2 sm:max-w-sm">
            <Label htmlFor="delete-email">
              {t.rich("typeEmail", { email, b: (chunks) => <span className="font-medium">{chunks}</span> })}
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
              <Label htmlFor="delete-password">{tCommon("password")}</Label>
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
              {tCommon("cancel")}
            </Button>
            <Button type="submit" variant="destructive" disabled={!confirmed || deleting}>
              {deleting && <Spinner />}
              {deleting ? tCommon("deleting") : t("forever")}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
