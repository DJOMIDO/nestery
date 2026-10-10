// src/components/tasks/TaskBoardSkeleton.tsx

import { Skeleton } from "@/components/ui/skeleton";

// Cards per column, so the lanes don't all look alike
const CARDS = [3, 2, 1, 2];

// The board's four lanes with placeholder cards, while tasks load
export function TaskBoardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading tasks"
      className="appear-late grid grid-cols-1 gap-4 md:grid-cols-2 lg:flex-1 lg:min-h-0 lg:grid-cols-4"
    >
      {CARDS.map((count, lane) => (
        <div
          key={lane}
          // min-h-0 and overflow-hidden: like a real column, a short screen cuts the cards off inside the lane
          className="flex min-h-0 flex-col gap-2 overflow-hidden rounded-xl bg-foreground/[0.03] p-3"
        >
          <div className="flex items-center gap-2 pb-1">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-3.5 w-20" />
          </div>
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="space-y-2 rounded-lg border bg-card p-3">
              <Skeleton className={i % 2 ? "h-3.5 w-1/2" : "h-3.5 w-3/4"} />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
