// src/components/assistant/ProposalCard.tsx
// A change the assistant proposed. Confirming saves it through the regular
// API (with its usual checks); nothing is written before that.

"use client";

import { useState } from "react";
import { CalendarClock, CalendarPlus, Check, ClipboardList, FilePlus2, Files, PencilLine, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useFormat } from "@/components/SettingsProvider";
import type { AssistantProposal, ProposalState } from "@/lib/assistant";
import type { Note } from "@/lib/notes";
import { request } from "@/lib/api";
import { notifyDataChanged } from "@/lib/dataChanged";
import { journeyLabel, reminderParts, type JourneyInput } from "@/lib/travel";
import { journeyIcon } from "@/components/travel/journeyIcon";
import type { Formatter } from "@/lib/format";

// Re-exported for the panel; the type lives with the other assistant types
// because saved conversations store each card's outcome
export type { ProposalState };

// The app's translator, from the messages' root
type Translate = ReturnType<typeof useTranslations<never>>;

// Shown for a field the change clears
const BLANK = "—";

// The keys that carry an event's timing, to tell a time change from a rename
const TIMING_KEYS = ["allDay", "startDate", "endDate", "startsAt", "endsAt"];

// "Mon, Oct 19, 9:30 – 10:00 AM", or "Oct 19 – Oct 20" for an all-day event
function eventWhen(
  e: { allDay?: boolean; startDate?: string; endDate?: string; startsAt?: string; endsAt?: string },
  format: Formatter,
  t: Translate
) {
  return e.allDay
    ? e.endDate && e.endDate !== e.startDate
      ? `${format.day(e.startDate!)} – ${format.day(e.endDate)}`
      : format.day(e.startDate!)
    : `${format.day(e.startsAt!)}${t("common.listSeparator")}${format.time(e.startsAt!)} – ${format.time(e.endsAt!)}`;
}

// The journey fields, in the order the card lists their changes
const JOURNEY_FIELD_ORDER: (keyof JourneyInput)[] = [
  "kind", "carrier", "number", "origin", "destination", "stopover",
  "originCity", "destinationCity", "departureDate", "departureTime",
  "arrivalDate", "arrivalTime", "seat", "gate", "coach", "vehicle",
  "aircraftReg", "price", "currency", "bookingRef", "notes", "remindBefore",
];

// A journey field's label; a few read differently for a flight and a train.
// Typed as the exact keys so the translator accepts them.
function journeyFieldLabel(key: keyof JourneyInput, flight: boolean) {
  switch (key) {
    case "kind": return "proposal.kind" as const;
    case "carrier": return flight ? ("travel.field.airline" as const) : ("travel.field.company" as const);
    case "number": return flight ? ("travel.field.flight" as const) : ("travel.field.train" as const);
    case "origin": return "travel.form.from" as const;
    case "destination": return "travel.form.to" as const;
    case "stopover": return "travel.field.stopover" as const;
    case "originCity": return "travel.form.fromCity" as const;
    case "destinationCity": return "travel.form.toCity" as const;
    case "departureDate": return "travel.form.departure" as const;
    case "departureTime": return "travel.form.departureTime" as const;
    case "arrivalDate": return "travel.form.arrival" as const;
    case "arrivalTime": return "travel.form.arrivalTime" as const;
    case "seat": return "travel.field.seat" as const;
    case "gate": return "travel.field.gate" as const;
    case "coach": return "travel.field.coach" as const;
    case "vehicle": return flight ? ("travel.field.aircraft" as const) : ("travel.field.trainType" as const);
    case "aircraftReg": return "travel.field.registration" as const;
    case "price": return "travel.field.price" as const;
    case "currency": return "travel.form.currency" as const;
    case "bookingRef": return "travel.form.bookingRef" as const;
    case "notes": return "travel.form.notes" as const;
    case "remindBefore": return "travel.field.reminder" as const;
  }
}

// The changed journey fields as label / new-value rows, in a fixed order
function journeyChangeRows(
  p: Extract<AssistantProposal, { kind: "update_journey" }>,
  format: Formatter,
  t: Translate
) {
  const flight = p.input.kind === "flight";
  const clock = (v: string | null) => {
    if (!v) return null;
    const [h, m] = v.split(":").map(Number);
    return format.time(new Date(2000, 0, 1, h, m));
  };
  const rows: { label: string; value: string }[] = [];
  for (const key of JOURNEY_FIELD_ORDER) {
    if (!(key in p.changes)) continue;
    const raw = p.changes[key] as string | number | null | undefined;
    let value: string;
    switch (key) {
      case "kind":
        value = flight ? t("travel.flight") : t("travel.train");
        break;
      case "departureDate":
      case "arrivalDate":
        value = raw ? format.day(String(raw)) : BLANK;
        break;
      case "departureTime":
      case "arrivalTime":
        value = clock(raw == null ? null : String(raw)) ?? BLANK;
        break;
      case "price":
        value = raw == null || raw === "" ? BLANK : `${raw}${p.input.currency ? ` ${p.input.currency}` : ""}`;
        break;
      case "remindBefore":
        value = raw == null ? t("travel.form.noReminder") : t("travel.remind.before", reminderParts(Number(raw)));
        break;
      default:
        value = raw == null || raw === "" ? BLANK : String(raw);
    }
    rows.push({ label: t(journeyFieldLabel(key, flight)), value });
  }
  return rows;
}

// One line describing the change, in the interface language; also what the
// assistant is told afterwards
export function describeProposal(p: AssistantProposal, format: Formatter, t: Translate) {
  switch (p.kind) {
    case "create_task":
      return p.input.dueDate
        ? t("proposal.newTaskDue", { title: p.input.title, date: format.day(p.input.dueDate) })
        : t("proposal.newTask", { title: p.input.title });
    case "update_task": {
      const c = p.changes;
      const parts = [
        c.title && t("proposal.rename", { title: c.title }),
        c.status && t("proposal.markStatus", { status: t(`tasks.status.${c.status}`) }),
        c.priority && t("proposal.priority", { priority: c.priority }),
        c.dueDate !== undefined &&
          (c.dueDate ? t("proposal.due", { date: format.day(c.dueDate) }) : t("proposal.noDue")),
      ].filter(Boolean);
      return t("proposal.taskChanges", { title: p.taskTitle, changes: parts.join(t("common.listSeparator")) });
    }
    case "create_journey": {
      const j = p.input;
      // Times are as printed (local at each end)
      const clock = (hhmm: string | null) => {
        if (!hhmm) return null;
        const [h, m] = hhmm.split(":").map(Number);
        return format.time(new Date(2000, 0, 1, h, m));
      };
      const times = [clock(j.departureTime), clock(j.arrivalTime)].filter(Boolean).join(" – ");
      const arrivalDay =
        j.arrivalDate && j.arrivalDate !== j.departureDate ? t("proposal.arrives", { date: format.day(j.arrivalDate) }) : "";
      return [
        `${journeyLabel(j)}: ${j.origin} → ${j.destination}`,
        `${format.dayWithWeekday(j.departureDate)}${times ? `${t("common.listSeparator")}${times}` : ""}${arrivalDay}`,
        j.seat && t("proposal.seat", { seat: j.seat }),
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "update_journey": {
      const labels = journeyChangeRows(p, format, t).map((r) => r.label);
      return t("proposal.journeyChanges", {
        name: journeyLabel(p.input),
        changes: labels.join(t("common.listSeparator")),
      });
    }
    case "create_event":
      return t("proposal.newEvent", { title: p.input.title, when: eventWhen(p.input, format, t) });
    case "update_event": {
      const c = p.changes;
      const parts = [
        c.title && t("proposal.rename", { title: c.title }),
        c.notes !== undefined && t(c.notes ? "proposal.eventNotes" : "proposal.eventNotesCleared"),
        TIMING_KEYS.some((k) => k in c) && t("proposal.moveTo", { when: eventWhen(c, format, t) }),
      ].filter(Boolean);
      return t("proposal.eventChanges", {
        title: p.eventTitle,
        scope: p.repeats ? p.scope : "",
        changes: parts.join(t("common.listSeparator")),
      });
    }
    case "create_note":
      return t("proposal.newNote", { title: p.input.title });
    case "update_note": {
      const c = p.changes;
      const parts = [
        c.title && t("proposal.rename", { title: c.title }),
        c.tags && (c.tags.length ? t("proposal.noteTags", { tags: c.tags.map((tag) => `#${tag}`).join(" ") }) : t("proposal.noTags")),
        c.appendMarkdown && t("proposal.appendText"),
      ].filter(Boolean);
      return t("proposal.noteChanges", { title: p.noteTitle, changes: parts.join(t("common.listSeparator")) });
    }
    case "split_note":
      return t("proposal.splitNote", { title: p.noteTitle, count: p.input.titles.length });
  }
}

// What the one line leaves out: the new notes' titles, a journey's new field
// values, or the start of some text
function ProposalDetails({ proposal: p }: { proposal: AssistantProposal }) {
  const format = useFormat();
  const t = useTranslations();
  if (p.kind === "split_note") {
    return (
      <ol className="mt-2 max-h-40 list-decimal space-y-0.5 overflow-y-auto pl-9 text-xs text-muted-foreground wrap-anywhere">
        {p.input.titles.map((title, i) => (
          <li key={i}>{title}</li>
        ))}
      </ol>
    );
  }
  if (p.kind === "update_journey") {
    const rows = journeyChangeRows(p, format, t);
    if (!rows.length) return null;
    return (
      <dl className="mt-2 space-y-0.5 pl-6 text-xs text-muted-foreground">
        {rows.map((r) => (
          <div key={r.label} className="flex gap-1">
            <dt className="shrink-0">{r.label}:</dt>
            <dd className="min-w-0 break-words">{r.value}</dd>
          </div>
        ))}
      </dl>
    );
  }
  const text =
    p.kind === "create_note"
      ? p.input.markdown
      : p.kind === "update_note"
        ? p.changes.appendMarkdown
        : p.kind === "update_event" && typeof p.changes.notes === "string"
          ? p.changes.notes
          : null;
  if (!text?.trim()) return null;
  return <p className="mt-2 line-clamp-3 whitespace-pre-wrap pl-6 text-xs text-muted-foreground wrap-anywhere">{text.trim()}</p>;
}

async function save(p: AssistantProposal) {
  switch (p.kind) {
    case "create_task":
      await request("/api/tasks", { method: "POST", body: JSON.stringify(p.input) });
      notifyDataChanged("tasks");
      return;
    case "update_task":
      await request(`/api/tasks/${p.taskId}`, { method: "PATCH", body: JSON.stringify(p.changes) });
      notifyDataChanged("tasks");
      return;
    case "create_journey":
      await request("/api/journeys", { method: "POST", body: JSON.stringify(p.input) });
      notifyDataChanged("journeys");
      return;
    case "update_journey":
      // PUT replaces the whole journey; the change is already merged into input
      await request(`/api/journeys/${p.journeyId}`, { method: "PUT", body: JSON.stringify(p.input) });
      notifyDataChanged("journeys");
      return;
    case "create_event":
      await request("/api/events", { method: "POST", body: JSON.stringify(p.input) });
      notifyDataChanged("events");
      return;
    case "update_event":
      if (p.detach) {
        // “This occurrence”: create the standalone event, then drop that day
        // from the series, exactly as the calendar does
        await request("/api/events", { method: "POST", body: JSON.stringify(p.detach.create) });
        await request(`/api/events/${p.detach.seriesId}`, {
          method: "PATCH",
          body: JSON.stringify({ exdates: p.detach.seriesExdates }),
        });
      } else {
        await request(`/api/events/${p.eventId}`, { method: "PATCH", body: JSON.stringify(p.changes) });
      }
      notifyDataChanged("events");
      return;
    case "create_note": {
      // Loaded only here: the editor is large
      const { markdownToContent } = await import("@/components/notes/markdown");
      const { title, markdown, tags } = p.input;
      await request("/api/notes", {
        method: "POST",
        body: JSON.stringify({ title, tags, ...markdownToContent(markdown) }),
      });
      notifyDataChanged("notes");
      return;
    }
    case "update_note": {
      const { appendMarkdown, ...changes } = p.changes;
      let body: object = changes;
      if (appendMarkdown) {
        // Added to the note as it is now
        const { markdownToContent } = await import("@/components/notes/markdown");
        const note = await request<Note>(`/api/notes/${p.noteId}`);
        body = { ...changes, ...markdownToContent(appendMarkdown, note.content) };
      }
      await request(`/api/notes/${p.noteId}`, { method: "PATCH", body: JSON.stringify(body) });
      notifyDataChanged("notes");
      return;
    }
    case "split_note":
      await request(`/api/notes/${p.noteId}/split`, { method: "POST", body: JSON.stringify(p.input) });
      notifyDataChanged("notes");
      return;
  }
}

const ICONS = {
  create_task: ClipboardList,
  update_task: PencilLine,
  create_event: CalendarPlus,
  update_event: CalendarClock,
  create_note: FilePlus2,
  update_note: PencilLine,
  split_note: Files,
};

const iconOf = (p: AssistantProposal) =>
  p.kind === "create_journey" || p.kind === "update_journey"
    ? journeyIcon(p.input.kind)
    : ICONS[p.kind];

// The toast shown once a proposal is saved
function successToast(p: AssistantProposal, t: Translate) {
  switch (p.kind) {
    case "update_task":
      return t("proposal.taskUpdated");
    case "create_journey":
      return t("proposal.addedToTravel");
    case "update_journey":
      return t("proposal.journeyUpdated");
    case "update_event":
      return t("proposal.eventUpdated");
    case "split_note":
      return t("proposal.noteSplit", { count: p.input.titles.length });
    default:
      return t("common.saved");
  }
}

export function ProposalCard({
  proposal,
  state,
  onSettled,
}: {
  proposal: AssistantProposal;
  state: ProposalState;
  // Reports the outcome, with a note for the assistant's next turn
  onSettled: (state: ProposalState, note?: string) => void;
}) {
  const format = useFormat();
  const t = useTranslations();
  const [error, setError] = useState<string | null>(null);
  const summary = describeProposal(proposal, format, t);
  const Icon = iconOf(proposal);

  const confirm = async () => {
    setError(null);
    onSettled("saving");
    try {
      await save(proposal);
      toast.success(successToast(proposal, t));
      onSettled("confirmed", `The user confirmed: ${summary}. It is saved.`);
    } catch (err) {
      setError((err as Error).message);
      onSettled("pending");
    }
  };

  const dismiss = () => onSettled("dismissed", `The user dismissed: ${summary}. Nothing was saved.`);

  return (
    <div className="rounded-md border bg-background p-3 text-sm">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0 text-leaf" />
        <p className="min-w-0 flex-1 break-words">{summary}</p>
      </div>
      <ProposalDetails proposal={proposal} />
      {state === "pending" || state === "saving" ? (
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={dismiss} disabled={state === "saving"}>
            {t("proposal.dismiss")}
          </Button>
          <Button size="sm" onClick={confirm} disabled={state === "saving"}>
            {state === "saving" && <Spinner />}
            {state === "saving" ? t("common.saving") : t("proposal.confirm")}
          </Button>
        </div>
      ) : (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          {state === "confirmed" ? <Check className="size-3.5 text-leaf" /> : <X className="size-3.5" />}
          {state === "confirmed" ? t("common.saved") : t("proposal.dismissed")}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
