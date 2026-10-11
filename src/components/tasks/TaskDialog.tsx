// src/components/tasks/TaskDialog.tsx
"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskForm } from "@/components/tasks/TaskForm";
import type { TaskInput } from "@/hooks/useTasks";
import type { Task } from "@/lib/tasks";

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Task being edited; omit to create a new one
  task?: Task | null;
  onSubmit: (input: TaskInput) => Promise<unknown>;
}

export function TaskDialog({ open, onOpenChange, task, onSubmit }: TaskDialogProps) {
  const t = useTranslations("tasks");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? t("editTask") : t("newTask")}</DialogTitle>
        </DialogHeader>
        {/* The content unmounts when closed, so the form resets on each open */}
        <TaskForm
          key={task?.id ?? "new"}
          task={task}
          idPrefix="task-dialog"
          onCancel={() => onOpenChange(false)}
          onSubmit={async (input) => {
            const result = await onSubmit(input);
            if (result) onOpenChange(false);
            return result;
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
