// app/dashboard/page.tsx

import { WelcomeCard } from "@/components/dashboard/WelcomeCard";
import { DateCard } from "@/components/dashboard/DateCard";
import { ReminderCard } from "@/components/dashboard/ReminderCard";
import { OverviewCard } from "@/components/dashboard/OverviewCard";
import { QuickActionCard } from "@/components/dashboard/QuickActionCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { DeadlinesCard } from "@/components/dashboard/DeadlinesCard";
import { MilestonesCard } from "@/components/dashboard/MilestonesCard";

export default function DashboardPage() {
  return (
    <div className="space-y-6 p-2">

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <WelcomeCard />
        <DateCard />
        <ReminderCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <OverviewCard />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6 auto-rows-min lg:col-span-2">
          <QuickActionCard />
          <RecentActivityCard />
          <DeadlinesCard />
          <MilestonesCard />
        </div>
      </div>
    </div>
  );
}
