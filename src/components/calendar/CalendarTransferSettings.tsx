// src/components/calendar/CalendarTransferSettings.tsx
"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Check, Copy, FileUp, Link2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/components/SettingsProvider";
import { request } from "@/lib/api";
import { cn } from "@/lib/utils";

// Settings > Calendar: importing an .ics file (part of "Other calendars") and
// the private link that shows Nestery in other apps

// ---- Import --------------------------------------------------------------

interface ImportSummary {
  found: number;
  toImport: number;
  repeating: number;
  unsupported: number;
  alreadyImported: number;
  cancelled: number;
}

type Unsupported = "first" | "skip";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function ImportCalendarFile() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [unsupported, setUnsupported] = useState<Unsupported>("first");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useTranslations("calendarSettings.import");
  const tCommon = useTranslations("common");
  const b = (chunks: React.ReactNode) => <strong className="text-foreground">{chunks}</strong>;

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const send = (text: string, choice: Unsupported, dryRun: boolean) =>
    request<{ summary: ImportSummary; created?: number }>("/api/calendar/import", {
      method: "POST",
      body: JSON.stringify({ ics: text, timeZone, unsupported: choice, dryRun }),
    });

  const preview = async (text: string, choice: Unsupported) => {
    setBusy(true);
    setError(null);
    try {
      setSummary((await send(text, choice, true)).summary);
    } catch (err) {
      setSummary(null);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const chooseFile = async (picked: File | undefined) => {
    if (!picked) return;
    if (picked.size > MAX_FILE_BYTES) {
      setError(t("tooLarge"));
      return;
    }
    const text = await picked.text();
    setFile({ name: picked.name, text });
    await preview(text, unsupported);
  };

  const changeUnsupported = (choice: Unsupported) => {
    setUnsupported(choice);
    if (file) preview(file.text, choice);
  };

  const runImport = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const { created } = await send(file.text, unsupported, false);
      toast.success(t("done", { count: created ?? 0, file: file.name }));
      reset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFile(null);
    setSummary(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">{t("title")}</h3>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept=".ics,text/calendar"
        hidden
        onChange={(e) => chooseFile(e.target.files?.[0])}
      />

      {!file ? (
        <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={busy}>
          <FileUp className="size-4 mr-1" /> {t("choose")}
        </Button>
      ) : (
        <div className="space-y-3 rounded-md border p-3" aria-live="polite">
          <p className="truncate text-sm font-medium">{file.name}</p>
          {summary && (
            <>
              <ul className="space-y-0.5 text-sm text-muted-foreground">
                <li>
                  {t.rich("toImport", { count: summary.toImport, b })}
                  {summary.repeating > 0 && t("repeating", { count: summary.repeating })}
                </li>
                {summary.alreadyImported > 0 && <li>{t("already", { count: summary.alreadyImported })}</li>}
                {summary.cancelled > 0 && <li>{t("cancelled", { count: summary.cancelled })}</li>}
              </ul>

              {summary.unsupported > 0 && (
                <fieldset className="space-y-1.5 rounded-md bg-muted/50 p-3 text-sm">
                  <legend className="float-left mb-1.5 w-full">
                    {t("unsupported", { count: summary.unsupported })}
                  </legend>
                  {(
                    [
                      ["first", t("first")],
                      ["skip", t("skip")],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="unsupported"
                        checked={unsupported === value}
                        onChange={() => changeUnsupported(value)}
                        className="accent-leaf"
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
              )}
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={reset} disabled={busy}>
              {tCommon("cancel")}
            </Button>
            <Button size="sm" onClick={runImport} disabled={busy || !summary || summary.toImport === 0}>
              <Upload className="size-4 mr-1" />
              {busy ? t("working") : summary?.toImport === 0 ? t("nothing") : t("import")}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// ---- Feed link -----------------------------------------------------------

// Settings > Calendar > Nestery in other apps
export function CalendarFeedSettings() {
  const { settings, loading, setFeed } = useSettings();
  const [confirm, setConfirm] = useState<"regenerate" | "off" | null>(null);
  const [busy, setBusy] = useState(false);
  const t = useTranslations("calendarSettings");
  const tCommon = useTranslations("common");

  const https =
    settings.feedToken && typeof window !== "undefined"
      ? `${window.location.origin}/api/calendar/feed/${settings.feedToken}.ics`
      : null;
  const webcal = https?.replace(/^https?:\/\//, "webcal://");

  const change = async (on: boolean) => {
    setBusy(true);
    const next = await setFeed(on);
    setBusy(false);
    setConfirm(null);
    if (next) toast.success(on ? t("feed.created") : t("feed.turnedOff"));
  };

  return (
    <section id="calendar-share" className="scroll-mt-4 space-y-3 rounded-lg border bg-card p-5">
      <div>
        <h2 className="font-semibold">{t("parts.share")}</h2>
        <p className="text-sm text-muted-foreground">{t("feed.description")}</p>
      </div>

      {loading ? null : !https ? (
        <Button variant="outline" size="sm" onClick={() => change(true)} disabled={busy}>
          <Link2 className="size-4 mr-1" /> {t("feed.create")}
        </Button>
      ) : (
        <div className="space-y-3">
          <CopyField label={t("feed.forApple")} value={webcal!} />
          <CopyField label={t("feed.forGoogle")} value={https} />

          {confirm ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-3 text-sm">
              <span className="flex-1">
                {confirm === "regenerate"
                  ? t("feed.regenerateWarning")
                  : t("feed.offWarning")}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(null)} disabled={busy}>
                {tCommon("cancel")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => change(confirm === "regenerate")}
                disabled={busy}
              >
                {confirm === "regenerate" ? t("feed.createNew") : t("feed.turnOff")}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirm("regenerate")}>
                {t("feed.newLink")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirm("off")}>
                {t("feed.turnOff")}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const t = useTranslations("calendarSettings.feed");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex gap-2">
        <Input readOnly value={value} onFocus={(e) => e.currentTarget.select()} className="h-8 font-mono text-xs" />
        <Button
          variant="outline"
          size="icon"
          className={cn("size-8 shrink-0", copied && "text-leaf")}
          onClick={copy}
          aria-label={copied ? t("copied") : t("copy")}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
