// src/components/dashboard/WelcomeCard.tsx

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useCurrentUserName } from "@/lib/useCurrentUserName";
import { NatureGrid } from "@/components/brand/NatureShapes";

// Translucent whites read on the green gradient in both themes
const PATTERN_COLORS = [
  "rgb(255 255 255 / 0.22)",
  "rgb(255 255 255 / 0.14)",
  "rgb(255 255 255 / 0.08)",
];

export function WelcomeCard() {
  const name = useCurrentUserName();

  return (
    <Card
      className={`
        relative overflow-hidden w-full rounded-lg shadow-sm
        text-white bg-gradient-to-r from-forest to-moss
        hover:shadow-md hover:brightness-110 transition
      `}
    >
      {/* Shapes on the right, fading out toward the greeting */}
      <div className="absolute inset-y-0 right-0 w-3/5 [mask-image:linear-gradient(to_right,transparent,black_70%)]">
        <NatureGrid seed={5} cols={4} rows={2} colors={PATTERN_COLORS} />
      </div>
      <CardContent className="relative p-4">
        <h2 className="text-2xl md:text-3xl font-semibold">Hello, {name}!</h2>
        <p className="mt-1 text-sm md:text-base font-medium">
          Welcome back to your dashboard.
        </p>
      </CardContent>
    </Card>
  );
}
