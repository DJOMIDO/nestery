// src/app/(app)/tasks/page.tsx
"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { TaskItem } from "@/components/tasks/TaskItem";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import {
  groupTasks,
  TASK_GROUP_LABELS,
  type Task,
  type TaskGroupKey,
} from "@/lib/tasks";

const OPEN_GROUPS: TaskGroupKey[] = ["overdue", "today", "upcoming", "noDate"];

export default function TasksPage() {
  const { tasks, loading, createTask, updateTask, deleteTask } = useTasks();
  const { projects } = useProjects();
  const [quickTitle, setQuickTitle] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [showDone, setShowDone] = useState(false);

  const groups = useMemo(() => groupTasks(tasks), [tasks]);
  const openCount = tasks.length - groups.done.length;

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    if (await createTask({ title })) setQuickTitle("");
  };

  const handleToggle = (task: Task) =>
    updateTask(task.id, { status: task.status === "done" ? "todo" : "done" });

  const handleDelete = async (task: Task) => {
    if (!(await deleteTask(task.id))) return;
    toast("Task deleted", {
      action: {
        label: "Undo",
        onClick: () =>
          createTask({
            title: task.title,
            description: task.description,
            projectId: task.projectId,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
            remindAt: task.remindAt,
          }),
      },
    });
  };

  const openEditor = (task: Task | null) => {
    setEditing(task);
    setDialogOpen(true);
  };

  const renderList = (list: Task[]) => (
    <ul className="space-y-1">
      {list.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onToggle={handleToggle}
          onEdit={openEditor}
          onDelete={handleDelete}
        />
      ))}
    </ul>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {openCount} open · {groups.done.length} completed
          </p>
        </div>
        <Button onClick={() => openEditor(null)}>
          <Plus className="w-4 h-4 mr-1" /> New Task
        </Button>
      </div>

      <form onSubmit={handleQuickAdd} className="flex gap-2">
        <Input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Add a task and press Enter"
          aria-label="Quick add task"
        />
        <Button type="submit" variant="outline" disabled={!quickTitle.trim()}>
          Add
        </Button>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No tasks yet. Add your first one above.
        </p>
      ) : (
        <>
          {OPEN_GROUPS.filter((key) => groups[key].length > 0).map((key) => (
            <section key={key} aria-label={TASK_GROUP_LABELS[key]}>
              <h2
                className={`text-sm font-semibold mb-2 ${
                  key === "overdue" ? "text-rose-600" : "text-muted-foreground"
                }`}
              >
                {TASK_GROUP_LABELS[key]} ({groups[key].length})
              </h2>
              {renderList(groups[key])}
            </section>
          ))}

          {groups.done.length > 0 && (
            <section aria-label={TASK_GROUP_LABELS.done}>
              <button
                onClick={() => setShowDone((v) => !v)}
                className="flex items-center gap-1 text-sm font-semibold text-muted-foreground mb-2"
              >
                {showDone ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                {TASK_GROUP_LABELS.done} ({groups.done.length})
              </button>
              {showDone && renderList(groups.done)}
            </section>
          )}
        </>
      )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
        projects={projects}
        onSubmit={(input) =>
          editing ? updateTask(editing.id, input) : createTask(input)
        }
      />
    </div>
  );
}
