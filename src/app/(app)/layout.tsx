// src/app/(app)/layout.tsx
// Shared shell (sidebar + mobile header) for all signed-in pages.

"use client";

import { AssistantProvider } from "@/components/assistant/AssistantProvider";
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
      <AssistantProvider>
        {/* With the sidebar there is no header to keep clear of the status bar */}
        <div className="flex flex-col h-screen desktop:pt-[var(--safe-top)]">
          <MobileHeader />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-auto bg-background text-foreground p-6 pb-[calc(1.5rem+var(--safe-bottom))]">
              {children}
            </main>
          </div>
        </div>
      </AssistantProvider>
    </SettingsProvider>
  );
}
