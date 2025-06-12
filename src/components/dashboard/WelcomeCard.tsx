// src/components/dashboard/WelcomeCard.tsx

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useCurrentUserName } from "@/lib/useCurrentUserName";

export function WelcomeCard() {
  const name = useCurrentUserName();

  return (
    <Card
      className={`
        w-full shadow-sm
        text-white bg-gradient-to-r from-purple-400 to-indigo-500
        dark:from-purple-700 dark:to-blue-800
        hover:shadow-md
        hover:from-purple-300 hover:to-indigo-400
        dark:hover:from-purple-600 dark:hover:to-blue-600
      `}
    >
      <CardContent className="p-4">
        <h2 className="text-2xl md:text-3xl font-semibold">Hello, {name}!</h2>
        <p className="mt-1 text-sm md:text-base font-medium">
          Welcome back to your dashboard.
        </p>
      </CardContent>
    </Card>
  );
}
