// src/components/travel/ImportDialog.tsx
// Imports flights or train journeys from a CSV file with the original travel
// tracker's columns. The file is read in the browser; the server checks each
// row, adds the valid ones and skips journeys already in the list.

"use client";

import { useRef, useState } from "react";
import { Download, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { request } from "@/lib/api";
import { csvRecords, toCsv } from "@/lib/csv";
import { CSV_COLUMNS, journeyFromCsv, journeyLabel, type JourneyInput, type JourneyKind } from "@/lib/travel";
import { cn } from "@/lib/utils";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

const KIND_LABELS: Record<JourneyKind, string> = { flight: "Flights", train: "Trains" };

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [kind, setKind] = useState<JourneyKind>("flight");
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<JourneyInput[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = (nextKind = kind) => {
    setKind(nextKind);
    setFileName(null);
    setRows(null);
    setProblem(null);
    setResult(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const downloadTemplate = () => {
    const blob = new Blob([toCsv([[...CSV_COLUMNS[kind]]])], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${kind}-journeys-template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const readFile = async (file: File | undefined) => {
    setRows(null);
    setResult(null);
    setProblem(null);
    if (!file) return;
    setFileName(file.name);
    if (file.size > MAX_FILE_BYTES) return setProblem("The file is larger than 2 MB.");
    try {
      const { columns, records } = csvRecords(await file.text());
      const required = CSV_COLUMNS[kind].slice(0, 2);
      const missing = required.filter((c) => !columns.includes(c));
      if (missing.length) {
        const other = kind === "flight" ? "train" : "flight";
        const looksLikeOther = CSV_COLUMNS[other].slice(0, 2).every((c) => columns.includes(c));
        return setProblem(
          looksLikeOther
            ? `This looks like a ${other} file. Switch to ${KIND_LABELS[other]} above.`
            : `Missing columns: ${missing.join(", ")}. Use the template's columns.`
        );
      }
      if (records.length === 0) return setProblem("The file has no rows.");
      setRows(records.map((r) => journeyFromCsv(kind, r)));
    } catch (err) {
      setProblem((err as Error).message);
    }
  };

  const runImport = async () => {
    if (!rows) return;
    setImporting(true);
    try {
      const outcome = await request<ImportResult>("/api/journeys/import", {
        method: "POST",
        body: JSON.stringify({ rows }),
      });
      setResult(outcome);
      if (outcome.imported > 0) onImported();
    } catch (err) {
      setProblem((err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from CSV</DialogTitle>
          <DialogDescription>
            One file per kind, with the template&apos;s columns (the same as the old travel tracker). Dates are
            YYYY-MM-DD, times HH:mm.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Kind of journeys">
              {(["flight", "train"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => reset(k)}
                  aria-pressed={kind === k}
                  className={cn(
                    "rounded px-3 py-1 text-sm",
                    kind === k ? "bg-leaf-soft text-leaf" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate} className="ml-auto">
              <Download className="mr-1 size-4" /> Template
            </Button>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => readFile(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" className="w-full" onClick={() => fileInput.current?.click()}>
            <FileUp className="mr-2 size-4" /> {fileName ?? "Choose a CSV file"}
          </Button>

          {problem && (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          )}

          {rows && !result && (
            <div className="space-y-2">
              <p className="text-sm">
                {rows.length} {rows.length === 1 ? "row" : "rows"} found. First ones:
              </p>
              <ul className="divide-y rounded-md border text-sm">
                {rows.slice(0, 5).map((r, i) => (
                  <li key={i} className="flex gap-3 px-3 py-1.5">
                    <span className="w-24 shrink-0 truncate font-medium">{journeyLabel(r)}</span>
                    <span className="flex-1 truncate">
                      {r.origin} → {r.destination}
                    </span>
                    <span className="shrink-0 text-muted-foreground">{r.departureDate}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result && (
            <div className="space-y-2 text-sm" aria-live="polite">
              <p>
                <strong>{result.imported}</strong> imported
                {result.skipped > 0 && `, ${result.skipped} already in your list`}
                {result.errors.length > 0 && `, ${result.errors.length} with errors`}.
              </p>
              {result.errors.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2 text-xs text-destructive">
                  {result.errors.map((e) => (
                    <li key={e.row}>
                      Line {e.row + 1}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {result ? "Close" : "Cancel"}
            </Button>
            {!result && (
              <Button type="button" onClick={runImport} disabled={!rows || importing}>
                {importing && <Spinner />}
                {importing ? "Importing…" : rows ? `Import ${rows.length}` : "Import"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
