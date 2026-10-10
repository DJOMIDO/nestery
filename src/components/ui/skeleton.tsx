import { cn } from "@/lib/utils"

// A placeholder bar in the shape of content that's still loading
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      data-slot="skeleton"
      className={cn("rounded-md bg-foreground/[0.07] motion-safe:animate-pulse", className)}
      {...props}
    />
  )
}

// Title widths, varied so the rows look like real ones
const WIDTHS = ["w-3/5", "w-2/5", "w-1/2", "w-2/3", "w-1/3"]

// Rows of a list while it loads: an optional icon, a title and a detail
// line. Like <Loading>, it shows only if loading takes a moment.
function ListSkeleton({
  label,
  rows = 5,
  icon = false,
  className,
  rowClassName,
}: {
  // Read out to screen readers, e.g. "Loading tasks"
  label: string
  rows?: number
  icon?: boolean
  className?: string
  // Padding per row, to line up with the list it stands in for
  rowClassName?: string
}) {
  return (
    <ul role="status" aria-label={label} className={cn("appear-late space-y-1", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className={cn("flex items-start gap-3 px-3 py-2", rowClassName)}>
          {icon && <Skeleton className="size-4 shrink-0 rounded" />}
          <div className="min-w-0 flex-1 space-y-2 py-0.5">
            <Skeleton className={cn("h-3.5", WIDTHS[i % WIDTHS.length])} />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </li>
      ))}
    </ul>
  )
}

export { Skeleton, ListSkeleton }
