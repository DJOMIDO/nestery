// src/hooks/useTasks.ts

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { Task } from "@/lib/tasks";

// Shape accepted by POST /api/tasks and PATCH /api/tasks/[id]
export interface TaskInput {
  title?: string;
  description?: string | null;
  projectId?: string | null;
  status?: Task["status"];
  priority?: Task["priority"];
  dueDate?: string | null;
  remindAt?: string | null;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

// Loads the current user's tasks and exposes create/update/delete helpers
// that keep the local list in sync. Errors are shown as toasts.
export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setTasks(await request<Task[]>("/api/tasks"));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const createTask = useCallback(async (input: TaskInput) => {
    try {
      const task = await request<Task>("/api/tasks", {
        method: "POST",
        body: JSON.stringify(input),
      });
      setTasks((prev) => [task, ...prev]);
      return task;
    } catch (err) {
      toast.error((err as Error).message);
      return null;
    }
  }, []);

  // Optimistic: apply the change locally first, roll back if the request fails
  const updateTask = useCallback(async (id: string, input: TaskInput) => {
    let previous: Task | undefined;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        previous = t;
        return { ...t, ...input };
      })
    );
    try {
      const task = await request<Task>(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
      return task;
    } catch (err) {
      if (previous) {
        const original = previous;
        setTasks((prev) => prev.map((t) => (t.id === id ? original : t)));
      }
      toast.error((err as Error).message);
      return null;
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    try {
      await request<null>(`/api/tasks/${id}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.id !== id));
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      return false;
    }
  }, []);

  return { tasks, loading, reload, createTask, updateTask, deleteTask };
}
