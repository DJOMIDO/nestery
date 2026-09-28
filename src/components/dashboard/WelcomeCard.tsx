// src/components/dashboard/WelcomeCard.tsx

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useCurrentUserName } from "@/lib/useCurrentUserName";

export function WelcomeCard() {
  const name = useCurrentUserName();

  return (
    <Card
      className={`
        w-full rounded-lg shadow-sm
        text-white bg-gradient-to-r from-forest to-moss
        hover:shadow-md hover:brightness-110 transition
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
