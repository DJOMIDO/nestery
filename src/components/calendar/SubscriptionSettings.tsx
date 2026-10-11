// src/components/calendar/SubscriptionSettings.tsx
"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/spinner";
import { ImportCalendarFile } from "@/components/calendar/CalendarTransferSettings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubscriptions } from "@/hooks/useSubscriptions";
import { useFormat } from "@/components/SettingsProvider";
import {
  SUBSCRIPTION_COLOR_KEYS,
  SUBSCRIPTION_COLORS,
  type CalendarSubscription,
  type SubscriptionColor,
} from "@/lib/subscriptions";
import { cn } from "@/lib/utils";

// Settings > Calendar > Other calendars: external .ics feeds shown read-only
export function SubscriptionSettings() {
  const { subscriptions, loading, add, update, remove, refresh } = useSubscriptions();
  const nextColor = SUBSCRIPTION_COLOR_KEYS[subscriptions.length % SUBSCRIPTION_COLOR_KEYS.length];
  const t = useTranslations("calendarSettings");
  const b = (chunks: React.ReactNode) => <strong>{chunks}</strong>;

  return (
    <section id="calendar-calendars" className="scroll-mt-4 space-y-4 rounded-lg border bg-card p-5">
      <div>
        <h2 className="font-semibold">{t("parts.calendars")}</h2>
        <p className="text-sm text-muted-foreground">{t("subs.description")}</p>
      </div>

      <div>
        <h3 className="text-sm font-medium">{t("subs.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("subs.hint")}</p>
      </div>

      {loading ? (
        <Loading />
      ) : (
        subscriptions.length > 0 && (
          <ul className="divide-y rounded-md border">
            {subscriptions.map((sub) => (
              <SubscriptionRow
                key={sub.id}
                subscription={sub}
                onUpdate={(input) => update(sub.id, input)}
                onRefresh={() => refresh(sub.id)}
                onRemove={() => remove(sub.id)}
              />
            ))}
          </ul>
        )
      )}

      <AddSubscriptionForm
        // Remount after each add so the form clears and picks the next color
        key={subscriptions.length}
        defaultColor={nextColor}
        onAdd={add}
      />

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">{t("subs.whereLink")}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>{t.rich("subs.ade", { b })}</li>
          <li>{t.rich("subs.icloud", { b })}</li>
          <li>{t.rich("subs.google", { b })}</li>
          <li>{t.rich("subs.outlook", { b })}</li>
        </ul>
      </details>

      <div className="border-t" />
      <ImportCalendarFile />
    </section>
  );
}

function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: SubscriptionColor;
  onChange: (color: SubscriptionColor) => void;
  label: string;
}) {
  const t = useTranslations("calendarSettings.colors");
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1.5">
      {SUBSCRIPTION_COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          aria-label={t(key)}
          onClick={() => onChange(key)}
          className={cn(
            "size-5 rounded-full outline-none ring-offset-2 ring-offset-card focus-visible:ring-2 focus-visible:ring-ring",
            SUBSCRIPTION_COLORS[key].dot,
            value === key && "ring-2 ring-foreground/60"
          )}
        />
      ))}
    </div>
  );
}

function SubscriptionRow({
  subscription: sub,
  onUpdate,
  onRefresh,
  onRemove,
}: {
  subscription: CalendarSubscription;
  onUpdate: (input: Partial<Pick<CalendarSubscription, "name" | "color" | "enabled">>) => unknown;
  onRefresh: () => Promise<CalendarSubscription | null>;
  onRemove: () => unknown;
}) {
  const format = useFormat();
  const t = useTranslations("calendarSettings");
  const tCommon = useTranslations("common");
  const [name, setName] = useState(sub.name);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed) return setName(sub.name);
    if (trimmed !== sub.name) onUpdate({ name: trimmed });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const updated = await onRefresh();
    setRefreshing(false);
    if (updated && !updated.lastError) toast.success(t("subs.upToDate", { name: updated.name }));
  };

  return (
    <li className="space-y-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          maxLength={60}
          aria-label={t("subs.calendarName")}
          className="h-8 w-48 font-medium"
        />
        <ColorPicker
          value={sub.color}
          onChange={(color) => onUpdate({ color })}
          label={t("subs.colorFor", { name: sub.name })}
        />
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label={t("subs.refresh", { name: sub.name })}
            title={t("subs.refreshNow")}
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          </Button>
          {confirmDelete ? (
            <>
              <Button variant="destructive" size="sm" className="h-8" onClick={onRemove}>
                {tCommon("remove")}
              </Button>
              <Button variant="ghost" size="sm" className="h-8" onClick={() => setConfirmDelete(false)}>
                {tCommon("cancel")}
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              aria-label={t("subs.removeNamed", { name: sub.name })}
              title={tCommon("remove")}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>
      <p className="truncate text-xs text-muted-foreground" title={sub.url}>
        {sub.url}
      </p>
      <p className={cn("text-xs", sub.lastError ? "text-destructive" : "text-muted-foreground")}>
        {sub.lastError
          ? t("subs.failed", { error: sub.lastError })
          : sub.lastFetchedAt
            ? t("subs.updated", { time: format.relative(sub.lastFetchedAt) })
            : t("subs.notFetched")}
        {!sub.enabled && t("subs.hidden")}
      </p>
    </li>
  );
}

function AddSubscriptionForm({
  defaultColor,
  onAdd,
}: {
  defaultColor: SubscriptionColor;
  onAdd: (input: { name: string; url: string; color: SubscriptionColor }) => Promise<{ error?: string }>;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [color, setColor] = useState<SubscriptionColor>(defaultColor);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const t = useTranslations("calendarSettings.subs");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return setError(t("needNameLink"));
    setError(null);
    setAdding(true);
    // The server fetches the link first, so this can take a few seconds
    const result = await onAdd({ name: name.trim(), url: url.trim(), color });
    setAdding(false);
    if (result.error) setError(result.error);
    else toast.success(t("subscribed", { name: name.trim() }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border border-dashed p-3">
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
        <div className="space-y-2">
          <Label htmlFor="sub-name">{t("name")}</Label>
          <Input
            id="sub-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            maxLength={60}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sub-url">{t("link")}</Label>
          <Input
            id="sub-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://… or webcal://…"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ColorPicker value={color} onChange={setColor} label={t("colorNew")} />
        <Button type="submit" size="sm" className="ml-auto" disabled={adding}>
          {adding ? (
            <>
              <RefreshCw className="size-4 mr-1 animate-spin" /> {t("checking")}
            </>
          ) : (
            <>
              <Plus className="size-4 mr-1" /> {t("subscribe")}
            </>
          )}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
