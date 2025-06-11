// src/components/dashboard/DeadlinesCard.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";

interface Deadline {
  id: number;
  task: string;
  due: string;
  status: "overdue" | "upcoming";
}

export function DeadlinesCard() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);

  useEffect(() => {
    setDeadlines([
      {
        id: 1,
        task: "Finalize wireframes",
        due: "2025-06-09",
        status: "overdue",
      },
      {
        id: 2,
        task: "Publish release notes",
        due: "2025-06-12",
        status: "upcoming",
      },
      {
        id: 3,
        task: "Client feedback meeting",
        due: "2025-06-13",
        status: "upcoming",
      },
    ]);
  }, []);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

  return (
    <Card className="w-full shadow-sm bg-white dark:bg-gray-800 hover:shadow-md">
      <CardContent className="p-4">

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Deadlines</h3>
          <Clock className="w-5 h-5 text-muted-foreground" />
        </div>

        <div className="space-y-0.5">
          {deadlines.map(({ id, task, due, status }) => (
            <div
              key={id}
              className={`
                flex items-center justify-between p-3 rounded-md
                hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
              `}
            >

              <div
                className={`
                  w-1 h-8 mr-3 rounded
                  ${status === "overdue" ? "bg-rose-500" : "bg-lime-500"}
                `}
              />

              <div className="flex-1 min-w-0">
                <span
                  className={`
                    inline-block px-2 py-1 rounded text-sm font-medium
                    ${
                      status === "overdue"
                        ? "bg-red-100 text-rose-600"
                        : "bg-lime-100 text-lime-600"
                    }
                  `}
                >
                  {task}
                </span>
              </div>

              <div className="flex items-center pl-2 space-x-2 whitespace-nowrap">
                <span className="text-xs text-muted-foreground">
                  {formatDate(due)}
                </span>
                <Badge
                  variant={status === "overdue" ? "destructive" : "outline"}
                  className="text-xs"
                >
                  {status === "overdue" ? "Overdue" : "Upcoming"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
