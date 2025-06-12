// src/components/dashboard/OverviewCard.tsx

"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MoreHorizontal, Menu } from "lucide-react";

export function OverviewCard() {
  const projects = [
    "Website Redesign",
    "Mobile App",
    "API Integration",
    "UX Review",
    "Marketing Campaign",
    "Data Migration",
    "Performance Optimization",
    "Security Audit",
    "Content Strategy",
  ];
  const tasks = [
    "Design mockups",
    "Write tests",
    "Deploy to staging",
    "Fix bugs",
    "Conduct user research",
    "Update documentation",
    "Prepare release notes",
    "Conduct code review",
    "Set up CI/CD pipeline",
    "Organize team meeting",
    "Create wireframes",
  ];
  const members = [
    "Alice Johnson",
    "Bob Smith",
    "Charlie Lee",
    "Dana White",
    "Eve Davis",
    "Frank Brown",
    "Grace Wilson",
    "Hank Miller",
    "Ivy Garcia",
    "Jack Martinez",
    "Kathy Rodriguez",
    "Leo Hernandez",
    "Mia Lopez",
    "Nina Gonzalez",
    "Oscar Perez",
    "Paul Taylor",
  ];

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (label: string) =>
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    return parts
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join("");
  };

  type Category = {
    label: string;
    items: string[];
    renderItems: () => React.ReactNode;
  };

  const categories: Category[] = [
    {
      label: `Projects (${projects.length})`,
      items: projects,
      renderItems: () =>
        (expanded["Projects"] ? projects : projects.slice(0, 3)).map((item) => (
          <div key={item} className="flex items-center justify-between py-1">
            <span className="inline-block bg-lime-100 dark:bg-lime-200 text-lime-600 hover:bg-lime-200 dark:hover:bg-lime-100 px-2 py-1 rounded text-sm">
              {item}
            </span>
            <button
              className="p-1 hover:bg-muted rounded"
              aria-label={`More options for ${item}`}
              title="More"
            >
              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )),
    },
    {
      label: `Tasks (${tasks.length})`,
      items: tasks,
      renderItems: () =>
        (expanded["Tasks"] ? tasks : tasks.slice(0, 3)).map((item) => (
          <div key={item} className="flex items-center justify-between py-1">
            <span className="inline-block bg-indigo-100 dark:bg-indigo-200 text-indigo-600 hover:bg-indigo-200 dark:hover:bg-indigo-100 px-2 py-1 rounded text-sm">
              {item}
            </span>
            <button
              className="p-1 hover:bg-muted rounded"
              aria-label={`More options for ${item}`}
              title="More"
            >
              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        )),
    },
    {
      label: `Team Members (${members.length})`,
      items: members,
      renderItems: () => {
        const visible = expanded["Team Members"]
          ? members
          : members.slice(0, 8);
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {visible.map((name) => (
                <div
                  key={name}
                  title={name}
                  className="
                    w-8 h-8 rounded-full bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-200 dark:hover:bg-cyan-100
                    text-cyan-600 flex items-center justify-center
                    text-sm font-medium"
                >
                  {getInitials(name)}
                </div>
              ))}
            </div>

            {members.length > 8 && (
              <button
                onClick={() => toggle("Team Members")}
                className="text-xs text-primary hover:underline"
              >
                {expanded["Team Members"]
                  ? "Show less"
                  : `+ ${members.length - 8} more`}
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <Card
      className="
        w-full
        hover:shadow-md
        bg-white dark:bg-gray-800
    "
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold hover:text-muted-foreground transition-colors duration-200">Overview</h3>
        </div>

        <div className="divide-y divide-muted-foreground">
          {categories.map(({ label, items, renderItems }) => {
            const isExpanded = expanded[label.split(" ")[0]];
            return (
              <div key={label} className="py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    {label}
                  </span>
                  <button
                    className="p-1 hover:bg-muted rounded"
                    aria-label={`More options for ${label}`}
                    title="More"
                  >
                    <Menu className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {renderItems()}

                {items.length > 3 && label.startsWith("Projects") && (
                  <button
                    className="mt-1 text-xs text-primary hover:underline"
                    onClick={() => toggle("Projects")}
                  >
                    {isExpanded ? "Show less" : `+ ${items.length - 3} more`}
                  </button>
                )}
                {items.length > 3 && label.startsWith("Tasks") && (
                  <button
                    className="mt-1 text-xs text-primary hover:underline"
                    onClick={() => toggle("Tasks")}
                  >
                    {isExpanded ? "Show less" : `+ ${items.length - 3} more`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
