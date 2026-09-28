// src/hooks/useTasksView.ts

import { useEffect, useState } from "react";

export type TasksView = "list" | "board";

const STORAGE_KEY = "tasks-view";

// List or board on the Tasks page, remembered per browser. Storage can be
// unavailable (private mode, blocked site data), so it falls back to "list".
export function useTasksView() {
  const [view, setView] = useState<TasksView>("list");

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "board") setView("board");
    } catch {}
  }, []);

  const changeView = (next: TasksView) => {
    setView(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  };

  return [view, changeView] as const;
}
