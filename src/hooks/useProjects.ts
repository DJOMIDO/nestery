// src/hooks/useProjects.ts

import { useCallback, useEffect, useState } from "react";
import type { Project } from "@/components/projects/NewProjectModal";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      setProjects(await res.json());
    } catch (err) {
      console.error("Error loading projects:", err);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { projects, reload };
}
