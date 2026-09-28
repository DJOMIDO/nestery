// src/components/auth/AuthShell.tsx
// Shared layout for the sign-in and sign-up pages: a pattern half, and a
// plain half with the brand card on top of the form.

import Link from "next/link";
import { NatureGrid, NesteryMark } from "@/components/brand/NatureShapes";

interface AuthShellProps {
  tagline: string;
  title: string;
  subtitle: string;
  // Different seeds give each page its own pattern
  seed: number;
  children: React.ReactNode;
}

export function AuthShell({ tagline, title, subtitle, seed, children }: AuthShellProps) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-background md:grid-cols-2">
      {/* Left: the pattern (md and up) */}
      <div className="relative hidden overflow-hidden md:block">
        <NatureGrid seed={seed} cols={4} rows={6} />
      </div>

      {/* Right: the form */}
      <div className="flex flex-col">
        {/* Narrow screens: a strip of the pattern in place of the left half */}
        <div className="relative h-24 overflow-hidden md:hidden">
          <NatureGrid seed={seed} cols={8} rows={1} />
        </div>

        <main className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-sm space-y-6">
            {/* Brand card */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <Link href="/home" className="flex w-fit items-center gap-2">
                <NesteryMark />
                <span className="text-lg font-bold tracking-tight">Nestery</span>
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
