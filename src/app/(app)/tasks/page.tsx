// src/app/(app)/tasks/page.tsx
"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { TaskItem } from "@/components/tasks/TaskItem";
import { TaskOverviewPanel } from "@/components/tasks/TaskOverviewPanel";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTasks } from "@/hooks/useTasks";
import {
  groupTasks,
  TASK_GROUP_LABELS,
  type Task,
  type TaskGroupKey,
} from "@/lib/tasks";

const OPEN_GROUPS: TaskGroupKey[] = ["overdue", "today", "upcoming", "noDate"];

const formatDay = (dateKey: string) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
};

export default function TasksPage() {
  const { tasks, loading, createTask, updateTask, deleteTask } = useTasks();
  // The side panel is only shown on large screens (Tailwind `lg`)
  const isWide = useMediaQuery("(min-width: 1024px)");

  const [quickTitle, setQuickTitle] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  const selected = isWide ? tasks.find((t) => t.id === selectedId) ?? null : null;

  const filtered = useMemo(
    () =>
      tasks.filter(
        (t) =>
          (!tagFilter || t.tags.includes(tagFilter)) &&
          (!dateFilter || t.dueDate === dateFilter)
      ),
    [tasks, tagFilter, dateFilter]
  );
  const groups = useMemo(() => groupTasks(filtered), [filtered]);
  const openCount = tasks.filter((t) => t.status !== "done").length;

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    // New tasks pick up the active filters so they stay visible
    const created = await createTask({
      title,
      tags: tagFilter ? [tagFilter] : [],
      dueDate: dateFilter,
    });
    if (created) setQuickTitle("");
  };

  const handleToggle = (task: Task) =>
    updateTask(task.id, { status: task.status === "done" ? "todo" : "done" });

  const handleDelete = async (task: Task) => {
    if (!(await deleteTask(task.id))) return;
    if (selectedId === task.id) setSelectedId(null);
    toast("Task deleted", {
      action: {
        label: "Undo",
        onClick: () =>
          createTask({
            title: task.title,
            description: task.description,
            tags: task.tags,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
            remindAt: task.remindAt,
          }),
      },
    });
  };

  // Wide screens edit in the side panel; narrow screens use the dialog
  const handleEdit = (task: Task) => {
    if (isWide) {
      setSelectedId(task.id);
    } else {
      setEditing(task);
      setDialogOpen(true);
    }
  };

  const openCreateDialog = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const renderList = (list: Task[]) => (
    <ul className="space-y-1">
      {list.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          selected={task.id === selected?.id}
          onSelect={handleEdit}
          onToggle={handleToggle}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onTagClick={setTagFilter}
        />
      ))}
    </ul>
  );

  const hasFilter = tagFilter || dateFilter;

  return (
    // On large screens both columns fill the viewport; the list scrolls on its own
    <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-1 gap-6 lg:h-full">
      {/* Left: task list */}
      <div className="space-y-6 min-w-0 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Tasks</h1>
            <p className="text-sm text-muted-foreground">
              {openCount} open · {tasks.length - openCount} completed
            </p>
          </div>
          <Button onClick={openCreateDialog}>
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

        {hasFilter && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Filtered by</span>
            {tagFilter && (
              <button
                onClick={() => setTagFilter(null)}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium"
                aria-label={`Clear tag filter #${tagFilter}`}
              >
                #{tagFilter} <X className="w-3 h-3" />
              </button>
            )}
            {dateFilter && (
              <button
                onClick={() => setDateFilter(null)}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium"
                aria-label="Clear date filter"
              >
                Due {formatDay(dateFilter)} <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading tasks…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {hasFilter ? "No tasks match these filters." : "No tasks yet. Add your first one above."}
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
      </div>

      {/* Right: details of the selected task, or an overview (wide screens only) */}
      <aside
        aria-label={selected ? "Task details" : "Task overview"}
        className="hidden lg:block min-w-0 min-h-0"
      >
        <div className="h-full overflow-y-auto rounded-lg border bg-card p-5">
          {selected ? (
            <TaskDetailPanel
              task={selected}
              onSave={(input) => updateTask(selected.id, input)}
              onDelete={() => handleDelete(selected)}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <TaskOverviewPanel
              tasks={tasks}
              dateFilter={dateFilter}
              onDateFilter={setDateFilter}
              tagFilter={tagFilter}
              onTagFilter={setTagFilter}
            />
          )}
        </div>
      </aside>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
        onSubmit={(input) =>
          editing ? updateTask(editing.id, input) : createTask(input)
        }
      />
    </div>
  );
}
