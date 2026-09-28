// src/hooks/useTasksView.ts

import { useStoredChoice } from "@/hooks/useStoredChoice";

export type TasksView = "list" | "board";

const VIEWS = ["list", "board"] as const;

// List or board on the Tasks page, remembered per browser
export const useTasksView = () => useStoredChoice<TasksView>("tasks-view", VIEWS, "list");
