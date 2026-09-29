// app/home/page.tsx

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NatureScatter, NesteryMark } from "@/components/brand/NatureShapes";
import { FeatureShowcase } from "@/components/landing/FeaturePreviews";

export default function LandingPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-16 text-center">
      <NatureScatter seed={7} />

      <div className="relative w-full max-w-4xl space-y-8">
        <div className="flex items-center justify-center gap-2">
          <NesteryMark />
          <span className="text-xl font-bold tracking-tight">Nestery</span>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            A calm home for your everyday.
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Tasks, notes, your calendar and your day at a glance — gathered in one quiet, personal space.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild size="lg" className="w-40">
            <Link href="/signup">Get started</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-40">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>

        <div className="pt-4">
          <FeatureShowcase />
        </div>
      </div>
    </main>
  );
}
