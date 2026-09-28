// app/home/page.tsx

import Link from "next/link";
import { LayoutDashboard, ListTodo, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NatureScatter, NesteryMark } from "@/components/brand/NatureShapes";

const FEATURES = [
  { icon: ListTodo, title: "Tasks", text: "Lists or a board, with due dates and reminders" },
  { icon: NotebookPen, title: "Notes", text: "Rich text or Markdown, saved as you type" },
  { icon: LayoutDashboard, title: "Dashboard", text: "Your day at a glance" },
];

export default function LandingPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-16 text-center">
      <NatureScatter seed={7} />

      <div className="relative max-w-2xl space-y-8">
        <div className="flex items-center justify-center gap-2">
          <NesteryMark />
          <span className="text-xl font-bold tracking-tight">Nestery</span>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            A calm home for your everyday.
          </h1>
          <p className="text-lg text-muted-foreground">
            Tasks, notes and your day at a glance — gathered in one quiet, personal space.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild size="lg" className="bg-forest text-white hover:bg-forest/90 w-40">
            <Link href="/signup">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-40">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>

        <ul className="grid gap-3 pt-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="rounded-lg border bg-card/80 p-4 text-left backdrop-blur-sm"
            >
              <span className="inline-flex rounded-md bg-leaf-soft p-1.5 text-leaf">
                <Icon className="w-4 h-4" />
              </span>
              <p className="mt-2 text-sm font-semibold">{title}</p>
              <p className="text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
