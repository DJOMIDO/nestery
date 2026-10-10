// src/components/assistant/ProposalCard.tsx
// A change the assistant proposed. Confirming saves it through the regular
// API (with its usual checks); nothing is written before that.

"use client";

import { useState } from "react";
import { CalendarPlus, Check, ClipboardList, PencilLine, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/components/SettingsProvider";
import type { AssistantProposal } from "@/lib/assistant";
import { request } from "@/lib/api";
import { notifyDataChanged } from "@/lib/dataChanged";
import { TASK_STATUS_LABELS } from "@/lib/tasks";
import type { Formatter } from "@/lib/format";

export type ProposalState = "pending" | "saving" | "confirmed" | "dismissed";

// One line describing the change, also what the assistant is told afterwards
export function describeProposal(p: AssistantProposal, format: Formatter) {
  switch (p.kind) {
    case "create_task":
      return `New task “${p.input.title}”${p.input.dueDate ? `, due ${format.day(p.input.dueDate)}` : ""}`;
    case "update_task": {
      const c = p.changes;
      const parts = [
        c.title && `rename to “${c.title}”`,
        c.status && `mark ${TASK_STATUS_LABELS[c.status].toLowerCase()}`,
        c.priority && `${c.priority} priority`,
        c.dueDate !== undefined && (c.dueDate ? `due ${format.day(c.dueDate)}` : "no due date"),
      ].filter(Boolean);
      return `Task “${p.taskTitle}”: ${parts.join(", ")}`;
    }
    case "create_event": {
      const e = p.input;
      const when = e.allDay
        ? e.endDate !== e.startDate
          ? `${format.day(e.startDate)} – ${format.day(e.endDate)}`
          : format.day(e.startDate)
        : `${format.day(e.startsAt)}, ${format.time(e.startsAt)} – ${format.time(e.endsAt)}`;
      return `New event “${e.title}”, ${when}`;
    }
  }
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
    case "create_event":
      await request("/api/events", { method: "POST", body: JSON.stringify(p.input) });
      notifyDataChanged("events");
      return;
  }
}

const ICONS = { create_task: ClipboardList, update_task: PencilLine, create_event: CalendarPlus };

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
  const [error, setError] = useState<string | null>(null);
  const summary = describeProposal(proposal, format);
  const Icon = ICONS[proposal.kind];

  const confirm = async () => {
    setError(null);
    onSettled("saving");
    try {
      await save(proposal);
      toast.success(proposal.kind === "update_task" ? "Task updated" : "Saved");
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
      {state === "pending" || state === "saving" ? (
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={dismiss} disabled={state === "saving"}>
            Dismiss
          </Button>
          <Button size="sm" onClick={confirm} disabled={state === "saving"}>
            {state === "saving" ? "Saving…" : "Confirm"}
          </Button>
        </div>
      ) : (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          {state === "confirmed" ? <Check className="size-3.5 text-leaf" /> : <X className="size-3.5" />}
          {state === "confirmed" ? "Saved" : "Dismissed"}
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
