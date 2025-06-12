// src/components/dashboard/QuickActionCard.tsx

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList, UserPlus, Calendar, CalendarClock, BellPlus } from "lucide-react";

export function QuickActionCard() {
  return (
    <Card className="w-full shadow-sm bg-white dark:bg-gray-800 hover:shadow-md">
      <CardContent className="p-4 flex flex-col">

        <div className="flex items-center justify-between mb-4 group">
          <h3 className="text-lg font-semibold group-hover:text-muted-foreground transition-colors duration-200">Quick Actions</h3>
          <Calendar className="w-6 h-6 text-muted-foreground group-hover:text-foreground transition-colors duration-200" />
        </div>

        <div className="flex flex-col items-center justify-center space-y-3">
          <Button size="sm" variant="outline" className="w-3/4">
            <Plus className="w-4 h-4 mr-1" /> New Project
          </Button>
          <Button size="sm" variant="outline" className="w-3/4">
            <ClipboardList className="w-4 h-4 mr-1" /> Add Task
          </Button>
          <Button size="sm" variant="outline" className="w-3/4">
            <UserPlus className="w-4 h-4 mr-1" /> Invite Member
          </Button>
          <Button size="sm" variant="outline" className="w-3/4">
            <Calendar className="w-4 h-4 mr-1" /> Create Meeting
          </Button>
          <Button size="sm" variant="outline" className="w-3/4">
            <CalendarClock className="w-4 h-4 mr-1" /> Create Event
          </Button>
          <Button size="sm" variant="outline" className="w-3/4">
            <BellPlus className="w-4 h-4 mr-1" /> Create Reminder
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
