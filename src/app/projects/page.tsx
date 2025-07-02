// src/app/projects/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import NewProjectModal, {
  Project,
} from "@/components/projects/NewProjectModal";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch the full list of projects from the server
  const loadProjects = async () => {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data: Project[] = await res.json();
      setProjects(data);
    } catch (err) {
      console.error("Error loading projects:", err);
    }
  };

  // Initial load
  useEffect(() => {
    loadProjects();
  }, []);

  // After creating a new project, re-fetch
  const handleCreated = async () => {
    setIsModalOpen(false);
    await loadProjects();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button onClick={() => setIsModalOpen(true)}>New Project</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Due Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((proj) => (
            <TableRow key={proj.id} className="hover:bg-muted">
              <TableCell>{proj.name}</TableCell>
              <TableCell>{proj.owner_id}</TableCell>
              <TableCell>{proj.status}</TableCell>
              <TableCell>{proj.due_date ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <NewProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
