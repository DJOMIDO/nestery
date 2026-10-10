// app/settings/page.tsx
"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Clock,
  CloudSun,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { AssistantSettings } from "@/components/settings/AssistantSettings";
import { CALENDAR_PARTS, CalendarSettings, type CalendarPart } from "@/components/settings/CalendarSettings";
import { DateTimeSettings } from "@/components/settings/DateTimeSettings";
import { WeatherSettings } from "@/components/settings/WeatherSettings";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  // `focus`: a part of the section to scroll to (only Calendar has parts)
  content: React.ComponentType<{ focus?: CalendarPart | null }>;
}

// Sections that are now parts of Calendar, so old links still land there
const MOVED_TO_CALENDAR: Record<string, CalendarPart> = {
  holidays: "holidays",
  calendars: "calendars",
  "import-export": "share",
};

// The categories in the left-hand list; the chosen one shows on the right
const SECTIONS: Section[] = [
  {
    id: "account",
    label: "Account",
    description: "Profile, password, sign-in, devices",
    icon: UserRound,
    content: AccountSettings,
  },
  {
    id: "assistant",
    label: "Assistant",
    description: "AI model and your API key",
    icon: Sparkles,
    content: AssistantSettings,
  },
  {
    id: "date-time",
    label: "Date & time",
    description: "Date format, 12/24-hour time, week start",
    icon: Clock,
    content: DateTimeSettings,
  },
  {
    id: "calendar",
    label: "Calendar",
    description: "Holidays, other calendars, sharing",
    icon: CalendarDays,
    content: CalendarSettings,
  },
  {
    id: "weather",
    label: "Weather",
    description: "Place for the dashboard's weather",
    icon: CloudSun,
    content: WeatherSettings,
  },

];

// useSearchParams needs a Suspense boundary on a statically rendered page
export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsView />
    </Suspense>
  );
}

function SettingsView() {
  const router = useRouter();
  const params = useSearchParams();
  // List and details side by side from `md` up; one at a time below
  const isWide = useMediaQuery("(min-width: 768px)");

  // ?section=… keeps the choice across reloads and lets other pages link to a
  // section; &focus=… scrolls to a part of it
  const sectionParam = params.get("section") ?? "";
  const moved = MOVED_TO_CALENDAR[sectionParam];
  const requested = SECTIONS.find((s) => s.id === (moved ? "calendar" : sectionParam));
  const current = requested ?? (isWide ? SECTIONS[0] : null);
  const focusParam = params.get("focus");
  const focus = moved ?? CALENDAR_PARTS.find((p) => p.id === focusParam)?.id ?? null;

  const open = (id: string | null) =>
    router.replace(id ? `/settings?section=${id}` : "/settings", { scroll: false });

  const showList = isWide || !current;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Preferences for your Nestery.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)] md:items-start">
        {showList && (
          <nav aria-label="Settings sections" className="rounded-lg border bg-card p-1.5 md:sticky md:top-0">
            <ul className="space-y-0.5">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                const active = section.id === current?.id;
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      onClick={() => open(section.id)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                        active ? "bg-leaf-soft text-leaf" : "hover:bg-muted"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{section.label}</span>
                        <span className={cn("block truncate text-xs", active ? "text-leaf/80" : "text-muted-foreground")}>
                          {section.description}
                        </span>
                      </span>
                      {/* On narrow screens the list leads to a separate page */}
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground md:hidden" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        {current && (
          <div className="min-w-0 space-y-3">
            {!isWide && (
              <Button variant="ghost" size="sm" className="-ml-2" onClick={() => open(null)}>
                <ArrowLeft className="size-4 mr-1" /> All settings
              </Button>
            )}
            <current.content focus={focus} />
          </div>
        )}
      </div>
    </div>
  );
}
