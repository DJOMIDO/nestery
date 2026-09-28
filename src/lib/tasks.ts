// src/lib/tasks.ts
// Task types and date helpers shared by the server, pages and dashboard.
// Keep this file free of server-only imports so client components can use it.

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

// A task as returned by /api/tasks
export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  tags: string[];
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null; // YYYY-MM-DD
  remindAt: string | null; // ISO timestamp
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Local calendar date as YYYY-MM-DD
export function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Splits "work, #study urgent" into ["work", "study", "urgent"] (deduplicated)
export function parseTags(input: string) {
  const tags = input
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#+/, "").trim())
    .filter(Boolean);
  return [...new Set(tags)];
}

export function addDays(dateKey: string, days: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return toDateKey(new Date(y, m - 1, d + days));
}

const priorityRank: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

// Earliest due date first, then higher priority first
export function compareTasks(a: Task, b: Task) {
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  return priorityRank[a.priority] - priorityRank[b.priority];
}

// Tasks by status for the board. Open columns use compareTasks; Done shows
// the most recently completed first.
export function boardColumns(tasks: Task[]): Record<TaskStatus, Task[]> {
  const columns: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [] };
  for (const task of tasks) columns[task.status].push(task);
  columns.todo.sort(compareTasks);
  columns.in_progress.sort(compareTasks);
  columns.done.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  return columns;
}

export type TaskGroupKey = "overdue" | "today" | "upcoming" | "noDate" | "done";

export const TASK_GROUP_LABELS: Record<TaskGroupKey, string> = {
  overdue: "Overdue",
  today: "Today",
  upcoming: "Upcoming",
  noDate: "No date",
  done: "Completed",
};

export function groupTasks(tasks: Task[], today = toDateKey(new Date())) {
  const groups: Record<TaskGroupKey, Task[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    noDate: [],
    done: [],
  };
  for (const task of [...tasks].sort(compareTasks)) {
    if (task.status === "done") groups.done.push(task);
    else if (!task.dueDate) groups.noDate.push(task);
    else if (task.dueDate < today) groups.overdue.push(task);
    else if (task.dueDate === today) groups.today.push(task);
    else groups.upcoming.push(task);
  }
  return groups;
}

// Open tasks that are overdue or due within the next `days` days
export function upcomingDeadlines(
  tasks: Task[],
  days = 7,
  today = toDateKey(new Date())
) {
  const until = addDays(today, days);
  return tasks
    .filter((t) => t.status !== "done" && t.dueDate && t.dueDate <= until)
    .sort(compareTasks);
}

// Open tasks whose reminder time falls before the end of today
export function dueReminders(tasks: Task[], now = new Date()) {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  return tasks
    .filter(
      (t) =>
        t.status !== "done" &&
        t.remindAt &&
        new Date(t.remindAt) <= endOfToday
    )
    .sort((a, b) => (a.remindAt! < b.remindAt! ? -1 : 1));
}

// Number of tasks per tag, most used first
export function tagCounts(tasks: Task[]) {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    for (const tag of task.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

// Monday of the week containing `dateKey`
export function startOfWeek(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay(); // 0 = Sunday
  return addDays(dateKey, -((day + 6) % 7));
}

// Summary for the current week (Monday to Sunday)
export function weekStats(tasks: Task[], today = toDateKey(new Date())) {
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const open = tasks.filter((t) => t.status !== "done");
  return {
    completed: tasks.filter(
      (t) =>
        t.status === "done" &&
        t.completedAt &&
        toDateKey(new Date(t.completedAt)) >= weekStart
    ).length,
    open: open.length,
    overdue: open.filter((t) => t.dueDate && t.dueDate < today).length,
    dueThisWeek: open.filter(
      (t) => t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd
    ).length,
  };
}

export interface TaskActivity {
  id: string;
  kind: "created" | "completed";
  title: string;
  at: string; // ISO timestamp
}

// Recent task events, newest first. Derived from createdAt / completedAt,
// so deleted tasks do not appear.
export function taskActivity(tasks: Task[], limit = 10): TaskActivity[] {
  const events: TaskActivity[] = [];
  for (const task of tasks) {
    events.push({
      id: `${task.id}-created`,
      kind: "created",
      title: task.title,
      at: task.createdAt,
    });
    if (task.completedAt) {
      events.push({
        id: `${task.id}-completed`,
        kind: "completed",
        title: task.title,
        at: task.completedAt,
      });
    }
  }
  return events.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
}

const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

// "just now", "5 minutes ago", "yesterday", "3 days ago", or a date
export function formatRelative(iso: string, now = new Date()) {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "just now";
  if (abs < 3600) return relativeFormat.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relativeFormat.format(Math.round(seconds / 3600), "hour");
  if (abs < 7 * 86400) return relativeFormat.format(Math.round(seconds / 86400), "day");
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
