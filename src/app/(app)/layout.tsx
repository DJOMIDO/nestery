// src/app/(app)/layout.tsx
// Shared shell (sidebar + mobile header) for all signed-in pages.

"use client";

import { MobileHeader } from "@/components/MobileHeader";
import { Sidebar } from "@/components/Sidebar";
import { SettingsProvider } from "@/components/SettingsProvider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SettingsProvider>
      <div className="flex flex-col h-screen">
        <MobileHeader />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto bg-background text-foreground p-6">
            {children}
          </main>
        </div>
      </div>
    </SettingsProvider>
  );
}
