// src/components/dashboard/QuickActionCard.tsx

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, Zap } from "lucide-react";

interface QuickActionCardProps {
  onAddTask: () => void;
}

export function QuickActionCard({ onAddTask }: QuickActionCardProps) {
  return (
    <Card className="w-full h-full shadow-sm bg-white dark:bg-gray-800 hover:shadow-md">
      <CardContent className="p-4 flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between mb-4 group">
          <h3 className="text-lg font-semibold group-hover:text-muted-foreground transition-colors duration-200">
            Quick Actions
          </h3>
          <Zap className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors duration-200" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center space-y-3">
          <Button
            size="sm"
            variant="outline"
            className="w-3/4"
            onClick={onAddTask}
          >
            <ClipboardList className="w-4 h-4 mr-1" /> Add Task
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
