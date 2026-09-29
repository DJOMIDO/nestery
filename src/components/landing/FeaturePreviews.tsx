// src/components/landing/FeaturePreviews.tsx
// The landing page's feature tiles: each shows a small, static drawing of the
// real UI (not a screenshot) in the theme's colors, so it follows light and
// dark mode. The drawings are decorative; screen readers get the heading and
// sentence of each tile.

import { Check, Code2 } from "lucide-react";
import { NatureShape, type ShapeName } from "@/components/brand/NatureShapes";
import { cn } from "@/lib/utils";

interface Tile {
  title: string;
  text: string;
  preview: React.ReactNode;
  shape: ShapeName;
  shapeColor: string;
  // Column span on the 5-column grid (sm and up)
  wide: boolean;
}

const TILES: Tile[] = [
  {
    title: "Calendar",
    text: "Months and weeks, repeating events, and your class timetable or other calendars subscribed right in.",
    preview: <CalendarPreview />,
    shape: "flower",
    shapeColor: "var(--leaf)",
    wide: true,
  },
  {
    title: "Notes",
    text: "Rich text or Markdown, with checklists and tables, saved as you type.",
    preview: <NotesPreview />,
    shape: "sprout",
    shapeColor: "var(--bark)",
    wide: false,
  },
  {
    title: "Dashboard",
    text: "Your day at a glance, across everything.",
    preview: <DashboardPreview />,
    shape: "rosette",
    shapeColor: "var(--moss)",
    wide: false,
  },
  {
    title: "Tasks",
    text: "Lists or a board, with due dates, reminders and tags.",
    preview: <TasksPreview />,
    shape: "pinwheel",
    shapeColor: "var(--forest)",
    wide: true,
  },
];

export function FeatureShowcase() {
  return (
    <ul aria-label="What's in Nestery" className="grid gap-4 sm:grid-cols-5">
      {TILES.map((tile) => (
        <li
          key={tile.title}
          className={cn(
            "group relative overflow-hidden rounded-xl border bg-card/85 p-4 text-left backdrop-blur-sm",
            "transition duration-200 hover:-translate-y-0.5 hover:shadow-lg",
            tile.wide ? "sm:col-span-3" : "sm:col-span-2"
          )}
        >
          <NatureShape
            name={tile.shape}
            color={tile.shapeColor}
            className="pointer-events-none absolute -right-6 -bottom-6 size-24 opacity-15 transition-transform duration-300 group-hover:rotate-12"
          />
          <div aria-hidden className="relative h-32 overflow-hidden rounded-lg border bg-background/80 p-3">
            {tile.preview}
          </div>
          <h2 className="relative mt-3 text-sm font-semibold">{tile.title}</h2>
          <p className="relative text-sm text-muted-foreground">{tile.text}</p>
        </li>
      ))}
    </ul>
  );
}

// ---- Previews ------------------------------------------------------------

// Stand-in for a line of text
function Bar({ className }: { className?: string }) {
  return <span className={cn("block h-1.5 rounded-full bg-muted-foreground/25", className)} />;
}

function CalendarPreview() {
  // Five weeks; a few days carry event dots, one is "today"
  // Spread over different weekdays so the month looks lived in
  const dots: Record<number, string[]> = {
    3: ["bg-leaf"],
    8: ["bg-sky-500", "bg-sky-500"],
    12: ["bg-bark"],
    15: ["bg-sky-500", "bg-leaf"],
    19: ["bg-leaf"],
    24: ["bg-sky-500"],
    26: ["bg-bark", "bg-leaf"],
    31: ["bg-sky-500"],
  };
  const today = 15;
  return (
    <div className="flex h-full gap-3">
      <div className="grid flex-1 grid-cols-7 grid-rows-5 gap-0.5">
        {Array.from({ length: 35 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "flex flex-col items-center justify-start gap-0.5 rounded-sm pt-0.5",
              i === today ? "bg-leaf-soft" : "bg-muted/40"
            )}
          >
            <span className={cn("size-1.5 rounded-full", i === today ? "bg-forest" : "bg-muted-foreground/30")} />
            <span className="flex gap-px">
              {(dots[i] ?? []).map((color, j) => (
                <span key={j} className={cn("size-1 rounded-full", color)} />
              ))}
            </span>
          </span>
        ))}
      </div>
      {/* The selected day's agenda */}
      <div className="hidden w-28 flex-col gap-1.5 text-[10px] sm:flex">
        <span className="font-semibold">Today</span>
        <span className="truncate rounded bg-sky-100 px-1.5 py-0.5 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200">
          10:00 Algo
        </span>
        <span className="truncate rounded bg-leaf-soft px-1.5 py-0.5 text-leaf">14:00 Team call</span>
        <span className="truncate rounded bg-bark-soft px-1.5 py-0.5 text-bark">FR · Holiday</span>
      </div>
    </div>
  );
}

function NotesPreview() {
  return (
    <div className="relative flex h-full flex-col gap-2 text-[10px]">
      <span className="text-xs font-bold">Trip ideas</span>
      <span>
        Remember to <mark className="rounded-sm bg-leaf-soft px-0.5 text-inherit">book the train</mark> early
      </span>
      <span className="flex items-center gap-1.5">
        <span className="flex size-3 items-center justify-center rounded-sm bg-leaf text-white">
          <Check className="size-2.5" strokeWidth={3} />
        </span>
        <span className="text-muted-foreground line-through">Passport</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm border border-muted-foreground/40" />
        <Bar className="w-16" />
      </span>
      <span className="absolute right-0 bottom-0 flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">
        <Code2 className="size-3" /> md
      </span>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="rounded-md bg-gradient-to-r from-forest to-moss px-2.5 py-2 text-white">
        <span className="block text-xs font-semibold">Hello, Sam!</span>
        <span className="block text-[9px] text-white/85">2 events · 3 tasks due</span>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2">
        {[
          ["5", "open tasks"],
          ["2", "events today"],
        ].map(([value, label]) => (
          <span key={label} className="flex flex-col justify-center rounded-md border bg-card px-2">
            <span className="text-sm font-bold text-leaf">{value}</span>
            <span className="text-[9px] text-muted-foreground">{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function TasksPreview() {
  const rows = [
    { done: true, width: "w-20", chip: null },
    { done: false, width: "w-28", chip: { text: "Today", className: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200" } },
    { done: false, width: "w-16", chip: { text: "#home", className: "bg-leaf-soft text-leaf" } },
  ];
  return (
    <div className="flex h-full gap-3">
      <ul className="flex flex-1 flex-col justify-center gap-2">
        {rows.map((row, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-3 shrink-0 items-center justify-center rounded-sm",
                row.done ? "bg-leaf text-white" : "border border-muted-foreground/40"
              )}
            >
              {row.done && <Check className="size-2.5" strokeWidth={3} />}
            </span>
            <Bar className={cn(row.width, row.done && "opacity-40")} />
            {row.chip && <span className={cn("rounded px-1.5 text-[9px]", row.chip.className)}>{row.chip.text}</span>}
          </li>
        ))}
      </ul>
      {/* A glimpse of the board view */}
      <div className="hidden w-32 grid-cols-3 gap-1 sm:grid">
        {[2, 1, 2].map((cards, col) => (
          <span key={col} className="flex flex-col gap-1 rounded-md bg-muted/50 p-1">
            <Bar className="w-3/4" />
            {Array.from({ length: cards }, (_, i) => (
              <span key={i} className="h-4 rounded-sm border bg-card" />
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
