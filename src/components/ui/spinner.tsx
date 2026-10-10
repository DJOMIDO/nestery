import { LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"

// A small turning circle, sized and colored like the text around it. Still
// when the system asks for reduced motion.
function Spinner({ className }: { className?: string }) {
  return (
    <LoaderCircle
      aria-hidden
      className={cn("size-[1em] shrink-0 motion-safe:animate-spin", className)}
    />
  )
}

// "Loading…" with a spinner, for a section waiting on its data. It shows only
// if loading takes a moment, so quick loads don't flash.
function Loading({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <p
      role="status"
      className={cn("appear-late flex items-center gap-2 text-sm text-muted-foreground", className)}
    >
      <Spinner />
      {label}…
    </p>
  )
}

export { Spinner, Loading }
