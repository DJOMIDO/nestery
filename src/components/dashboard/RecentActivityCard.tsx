// src/components/dashboard/RecentActivityCard.tsx

"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Activity,
  MessageCircle,
  ClipboardList,
  CheckCircle2,
  UserPlus,
  FileText,
} from "lucide-react";
import { useState, useEffect } from "react";

interface ActivityItem {
  id: number;
  text: string;
  time: string;
}

export function RecentActivityCard() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    setActivities([
      { id: 1, text: "Alice commented on 'Website Redesign'", time: "09:12" },
      { id: 2, text: "Bob created task 'Write tests'", time: "08:45" },
      { id: 3, text: "Charlie completed 'UX Review'", time: "Yesterday" },
      { id: 4, text: "Dana joined project 'Mobile App'", time: "2 days ago" },
      {
        id: 5,
        text: "Eve updated docs for 'API Integration'",
        time: "3 days ago",
      },
    ]);
  }, []);

  const getIcon = (text: string) => {
    if (text.includes("commented")) return MessageCircle;
    if (text.includes("created")) return ClipboardList;
    if (text.includes("completed")) return CheckCircle2;
    if (text.includes("joined")) return UserPlus;
    if (text.includes("updated")) return FileText;
    return Activity;
  };

  return (
    <Card className="w-full shadow-sm bg-white dark:bg-gray-800 hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Recent Activity</h3>
          <Activity className="w-5 h-5 text-muted-foreground" />
        </div>
        <ul className="space-y-0.5">
          {activities.map(({ id, text, time }) => {
            const Icon = getIcon(text);
            return (
              <li
                key={id}
                className="flex justify-between items-start p-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-l-4 border-transparent hover:border-indigo-500"
              >
                <a
                  href="#"
                  className="flex items-center space-x-2 flex-1 min-w-0 hover:text-primary hover:underline"
                >
                  <Icon className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <span
                    className="inline-block bg-indigo-100 text-indigo-600 dark:bg-indigo-200
                 px-2 py-1 rounded text-sm font-medium truncate whitespace-nowrap overflow-hidden"
                  >
                    {text}
                  </span>
                </a>
                <span className="pl-2 text-xs text-muted-foreground whitespace-nowrap">
                  {time}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
