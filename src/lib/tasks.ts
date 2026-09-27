// src/lib/tasks.ts
// Task types and date helpers shared by the server, pages and dashboard.
// Keep this file free of server-only imports so client components can use it.

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

// A task as returned by /api/tasks
export interface Task {
  id: string;
  userId: string;
  projectId: string | null;
  projectName: string | null;
  title: string;
  description: string | null;
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
