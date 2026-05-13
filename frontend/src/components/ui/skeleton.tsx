import { cn } from "@/lib/utils"

/**
 * Minimal skeleton placeholder. Uses tw-animate-css `animate-pulse`.
 */
export function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-xl bg-muted/60", className)}
      {...props}
    />
  )
}
