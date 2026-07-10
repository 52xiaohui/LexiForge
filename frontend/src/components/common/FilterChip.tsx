import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface FilterChipProps {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
  /** Accessible pressed state (filter / toggle chips). */
  "aria-pressed"?: boolean
  "aria-label"?: string
}

/**
 * Pill-shaped filter/toggle chip. Active state uses brand primary wash so
 * mastery chips, topic chips, and similar controls share one visual language.
 */
export function FilterChip({
  active = false,
  onClick,
  children,
  className,
  ...aria
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aria["aria-pressed"] ?? active}
      aria-label={aria["aria-label"]}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border/60 text-muted-foreground hover:border-foreground/40 hover:bg-muted/50 hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  )
}
