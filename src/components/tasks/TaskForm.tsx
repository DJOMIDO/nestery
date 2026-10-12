// src/components/tasks/TaskForm.tsx
// Task fields shared by the create/edit dialog and the detail panel.
// Mount with a `key` per task so the form starts from that task's values.
"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaskInput } from "@/hooks/useTasks";
import { cn } from "@/lib/utils";
import { TagInput } from "@/components/TagInput";
import {
  TASK_STATUSES,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks";

// ISO timestamp -> value for <input type="datetime-local"> in local time
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

interface TaskFormProps {
  // Task being edited; omit to create a new one
  task?: Task | null;
  // Resolve to a truthy value on success
  onSubmit: (input: TaskInput) => Promise<unknown>;
  onCancel?: () => void;
  // Rendered at the start of the button row, e.g. a delete button
  extraActions?: React.ReactNode;
  idPrefix?: string;
  // Fill the parent's height: the description grows, the buttons sit at the bottom
  fill?: boolean;
}

export function TaskForm({
  task,
  onSubmit,
  onCancel,
  extraActions,
  idPrefix = "task",
  fill = false,
}: TaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [tags, setTags] = useState<string[]>(task?.tags ?? []);
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [remindAt, setRemindAt] = useState(toLocalInput(task?.remindAt ?? null));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const id = (field: string) => `${idPrefix}-${field}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t("form.titleRequired"));
      return;
    }
    setError("");
    setSaving(true);
    await onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      tags,
      status,
      priority,
      dueDate: dueDate || null,
      remindAt: remindAt ? new Date(remindAt).toISOString() : null,
    });
    setSaving(false);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("space-y-5", fill && "flex flex-col flex-1 min-h-0")}
    >
      <div>
        <Label htmlFor={id("title")}>{t("form.title")}</Label>
        <Input
          id={id("title")}
          className="mt-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus={!task}
        />
      </div>
      <div className={cn(fill && "flex flex-col flex-1 min-h-32")}>
        <Label htmlFor={id("desc")}>{t("form.description")}</Label>
        <Textarea
          id={id("desc")}
          className={cn("mt-2", fill && "flex-1 resize-none")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor={id("tags")}>{t("form.tags")}</Label>
        {/* Suggests the tags already on tasks and notes */}
        <TagInput id={id("tags")} className="mt-2" value={tags} onChange={setTags} placeholder={t("form.tagsPlaceholder")} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor={id("priority")}>{t("form.priority")}</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
            <SelectTrigger id={id("priority")} className="mt-2 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">{t("priority.high")}</SelectItem>
              <SelectItem value="medium">{t("priority.medium")}</SelectItem>
              <SelectItem value="low">{t("priority.low")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={id("status")}>{t("form.status")}</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
            <SelectTrigger id={id("status")} className="mt-2 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`status.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {/* Stacked on phones: datetime inputs are too wide to share a row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <Label htmlFor={id("due")}>{t("form.dueDate")}</Label>
          <Input
            id={id("due")}
            type="date"
            className="mt-2"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="min-w-0">
          <Label htmlFor={id("remind")}>{t("form.remindAt")}</Label>
          <Input
            id={id("remind")}
            type="datetime-local"
            className="mt-2"
            value={remindAt}
            onChange={(e) => setRemindAt(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className={cn("flex items-center gap-3", fill && "mt-auto")}>
        {extraActions}
        <div className="flex-1" />
        {onCancel && (
          <Button variant="outline" type="button" onClick={onCancel} disabled={saving}>
            {tCommon("cancel")}
          </Button>
        )}
        <Button type="submit" disabled={saving}>
          {saving && <Spinner />}
          {saving ? tCommon("saving") : task ? tCommon("save") : tCommon("create")}
        </Button>
      </div>
    </form>
  );
}
