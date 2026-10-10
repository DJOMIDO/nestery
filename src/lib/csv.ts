// src/lib/csv.ts
// A small CSV reader and writer (RFC 4180: quoted fields, "" for a quote,
// commas and line breaks inside quotes).

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");

  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (quoted) throw new Error("The file has a quoted field that is never closed");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Blank lines are not rows
  return rows.filter((r) => r.some((value) => value.trim()));
}

// Rows as objects keyed by the header row
export function csvRecords(text: string) {
  const [header, ...rows] = parseCsv(text);
  if (!header) return { columns: [], records: [] };
  const columns = header.map((h) => h.trim());
  const records = rows.map((r) => Object.fromEntries(columns.map((column, i) => [column, r[i] ?? ""])));
  return { columns, records };
}

const quote = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export const toCsv = (rows: string[][]) => rows.map((r) => r.map(quote).join(",")).join("\r\n") + "\r\n";
