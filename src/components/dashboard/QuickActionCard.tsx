// src/components/dashboard/QuickActionCard.tsx

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { CardHeading } from "./CardHeading";
import { Button } from "@/components/ui/button";
import { ClipboardList, Zap } from "lucide-react";

interface QuickActionCardProps {
  onAddTask: () => void;
}

export function QuickActionCard({ onAddTask }: QuickActionCardProps) {
  return (
    <Card className="w-full h-full rounded-lg shadow-sm bg-card hover:shadow-md">
      <CardContent className="p-4 flex flex-col flex-1 min-h-0">
        <CardHeading title="Quick Actions" icon={Zap} />
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
