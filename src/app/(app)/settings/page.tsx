// app/settings/page.tsx
"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  CloudSun,
  Languages,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { AssistantSettings } from "@/components/settings/AssistantSettings";
import { CALENDAR_PARTS, CalendarSettings, type CalendarPart } from "@/components/settings/CalendarSettings";
import { LanguageTimeSettings } from "@/components/settings/LanguageTimeSettings";
import { WeatherSettings } from "@/components/settings/WeatherSettings";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  // Its label and description in messages (settings.sections.<key>)
  key: "account" | "assistant" | "languageTime" | "calendar" | "weather";
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
    key: "account",
    icon: UserRound,
    content: AccountSettings,
  },
  {
    id: "assistant",
    key: "assistant",
    icon: Sparkles,
    content: AssistantSettings,
  },
  {
    // Was "Date & time"; the id stays so links to it keep working
    id: "date-time",
    key: "languageTime",
    icon: Languages,
    content: LanguageTimeSettings,
  },
  {
    id: "calendar",
    key: "calendar",
    icon: CalendarDays,
    content: CalendarSettings,
  },
  {
    id: "weather",
    key: "weather",
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
  const t = useTranslations("settings");
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
  const focus = moved ?? CALENDAR_PARTS.find((p) => p === focusParam) ?? null;

  const open = (id: string | null) =>
    router.replace(id ? `/settings?section=${id}` : "/settings", { scroll: false });

  const showList = isWide || !current;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[16rem_minmax(0,1fr)] md:items-start">
        {showList && (
          <nav aria-label={t("sectionsLabel")} className="rounded-lg border bg-card p-1.5 md:sticky md:top-0">
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
                        <span className="block text-sm font-medium">{t(`sections.${section.key}.label`)}</span>
                        <span className={cn("block truncate text-xs", active ? "text-leaf/80" : "text-muted-foreground")}>
                          {t(`sections.${section.key}.description`)}
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
                <ArrowLeft className="size-4 mr-1" /> {t("allSettings")}
              </Button>
            )}
            <current.content focus={focus} />
          </div>
        )}
      </div>
    </div>
  );
}
