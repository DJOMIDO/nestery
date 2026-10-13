// src/components/assistant/ProposalCard.tsx
// A change the assistant proposed. Confirming saves it through the regular
// API (with its usual checks); nothing is written before that.

"use client";

import { useState } from "react";
import { CalendarPlus, Check, ClipboardList, FilePlus2, Files, PencilLine, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useFormat } from "@/components/SettingsProvider";
import type { AssistantProposal } from "@/lib/assistant";
import type { Note } from "@/lib/notes";
import { request } from "@/lib/api";
import { notifyDataChanged } from "@/lib/dataChanged";
import { journeyLabel } from "@/lib/travel";
import { journeyIcon } from "@/components/travel/journeyIcon";
import type { Formatter } from "@/lib/format";

export type ProposalState = "pending" | "saving" | "confirmed" | "dismissed";

// The app's translator, from the messages' root
type Translate = ReturnType<typeof useTranslations<never>>;

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
    case "create_event": {
      const e = p.input;
      const when = e.allDay
        ? e.endDate !== e.startDate
          ? `${format.day(e.startDate)} – ${format.day(e.endDate)}`
          : format.day(e.startDate)
        : `${format.day(e.startsAt)}${t("common.listSeparator")}${format.time(e.startsAt)} – ${format.time(e.endsAt)}`;
      return t("proposal.newEvent", { title: e.title, when });
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

// What the one line leaves out: the new notes' titles, or the start of the text
function ProposalDetails({ proposal: p }: { proposal: AssistantProposal }) {
  if (p.kind === "split_note") {
    return (
      <ol className="mt-2 max-h-40 list-decimal space-y-0.5 overflow-y-auto pl-9 text-xs text-muted-foreground wrap-anywhere">
        {p.input.titles.map((title, i) => (
          <li key={i}>{title}</li>
        ))}
      </ol>
    );
  }
  const text = p.kind === "create_note" ? p.input.markdown : p.kind === "update_note" ? p.changes.appendMarkdown : null;
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
    case "create_event":
      await request("/api/events", { method: "POST", body: JSON.stringify(p.input) });
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
  create_note: FilePlus2,
  update_note: PencilLine,
  split_note: Files,
};

const iconOf = (p: AssistantProposal) =>
  p.kind === "create_journey" ? journeyIcon(p.input.kind) : ICONS[p.kind];

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
      toast.success(
        proposal.kind === "update_task"
          ? t("proposal.taskUpdated")
          : proposal.kind === "create_journey"
            ? t("proposal.addedToTravel")
            : proposal.kind === "split_note"
              ? t("proposal.noteSplit", { count: proposal.input.titles.length })
              : t("common.saved")
      );
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
