import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface FilterToolbarProps {
  children: ReactNode
  className?: string
}

/** Muted bordered strip that groups search / filter controls on list pages. */
export function FilterToolbar({ children, className }: FilterToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-muted/30 p-3",
        className
      )}
    >
      {children}
    </div>
  )
}
