// src/components/calendar/CalendarTransferSettings.tsx
"use client";

import { useRef, useState } from "react";
import { Check, Copy, FileUp, Link2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/components/SettingsProvider";
import { request } from "@/lib/api";
import { cn } from "@/lib/utils";

// Settings > Import & export: bring an .ics file in, or let other apps
// subscribe to this calendar
export function CalendarTransferSettings() {
  return (
    <section className="space-y-6 rounded-lg border bg-card p-5">
      <div>
        <h2 className="font-semibold">Import &amp; export</h2>
        <p className="text-sm text-muted-foreground">
          Copy events from another calendar into Nestery, or show your Nestery calendar in other apps.
        </p>
      </div>
      <ImportFile />
      <div className="border-t" />
      <FeedLink />
    </section>
  );
}

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

function ImportFile() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [unsupported, setUnsupported] = useState<Unsupported>("first");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      setError("The file is too large (over 5 MB)");
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
      toast.success(`Imported ${created} ${created === 1 ? "event" : "events"} from ${file.name}`);
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
        <h3 className="text-sm font-medium">Import a file</h3>
        <p className="text-sm text-muted-foreground">
          Events from an .ics file become your own events that you can edit. Importing the same file again skips
          events it already added.
        </p>
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
          <FileUp className="size-4 mr-1" /> Choose .ics file
        </Button>
      ) : (
        <div className="space-y-3 rounded-md border p-3" aria-live="polite">
          <p className="truncate text-sm font-medium">{file.name}</p>
          {summary && (
            <>
              <ul className="space-y-0.5 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">{summary.toImport}</strong>{" "}
                  {summary.toImport === 1 ? "event" : "events"} to import
                  {summary.repeating > 0 && `, ${summary.repeating} of them repeating`}
                </li>
                {summary.alreadyImported > 0 && <li>{summary.alreadyImported} already imported (skipped)</li>}
                {summary.cancelled > 0 && <li>{summary.cancelled} cancelled (skipped)</li>}
              </ul>

              {summary.unsupported > 0 && (
                <fieldset className="space-y-1.5 rounded-md bg-muted/50 p-3 text-sm">
                  <legend className="float-left mb-1.5 w-full">
                    {summary.unsupported} repeating {summary.unsupported === 1 ? "event uses" : "events use"} a
                    pattern Nestery can&apos;t repeat (for example &ldquo;last Friday of the month&rdquo;):
                  </legend>
                  {(
                    [
                      ["first", "Import just the first occurrence"],
                      ["skip", "Skip them"],
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
              Cancel
            </Button>
            <Button size="sm" onClick={runImport} disabled={busy || !summary || summary.toImport === 0}>
              <Upload className="size-4 mr-1" />
              {busy ? "Working…" : summary?.toImport === 0 ? "Nothing to import" : "Import"}
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

function FeedLink() {
  const { settings, loading, setFeed } = useSettings();
  const [confirm, setConfirm] = useState<"regenerate" | "off" | null>(null);
  const [busy, setBusy] = useState(false);

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
    if (next) toast.success(on ? "New calendar link created" : "Calendar link turned off");
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">Subscribe from other apps</h3>
        <p className="text-sm text-muted-foreground">
          A private link to your events and open tasks&apos; due dates, for Apple Calendar, Google Calendar, Outlook
          or your phone. Apps check it for changes every few hours; anyone with the link can see your calendar.
        </p>
      </div>

      {loading ? null : !https ? (
        <Button variant="outline" size="sm" onClick={() => change(true)} disabled={busy}>
          <Link2 className="size-4 mr-1" /> Create calendar link
        </Button>
      ) : (
        <div className="space-y-3">
          <CopyField label="For Apple Calendar and phones (opens the app)" value={webcal!} />
          <CopyField label="For Google Calendar (Other calendars → From URL) and Outlook" value={https} />

          {confirm ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-3 text-sm">
              <span className="flex-1">
                {confirm === "regenerate"
                  ? "The current link will stop working. Apps using it need the new one."
                  : "The link will stop working and apps will stop updating."}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setConfirm(null)} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => change(confirm === "regenerate")}
                disabled={busy}
              >
                {confirm === "regenerate" ? "Create new link" : "Turn off"}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirm("regenerate")}>
                New link
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirm("off")}>
                Turn off
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy; select the link and copy it instead");
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
          aria-label={copied ? "Copied" : "Copy link"}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
