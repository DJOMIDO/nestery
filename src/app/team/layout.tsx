// app/team/layout.tsx

"use client";

import { MobileHeader } from "@/components/MobileHeader";
import { Sidebar } from "@/components/Sidebar";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen">
      <MobileHeader />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-background text-foreground p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
