// app/home/page.tsx

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen px-4 text-center landing-bg">
      <div className="absolute inset-0 opacity-70 -z-10" />

      <div className="max-w-2xl space-y-6">
        <h1 className="text-5xl font-bold text-white tracking-tight">
          Welcome to Nestery
        </h1>
        <p className="text-xl text-white">
          Your all-in-one workspace for team collaboration and organization.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/signup">
            <Button className="text-base px-6 py-2">Get Started</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="text-base px-6 py-2">
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
