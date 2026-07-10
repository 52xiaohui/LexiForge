import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface PageHeaderProps {
  /** One-line description under the shell title (counts, guidance). */
  description?: ReactNode
  /** Optional trailing action (e.g. "新文章"). */
  action?: ReactNode
  /** Optional secondary note aligned opposite description on wide screens. */
  aside?: ReactNode
  className?: string
}

/**
 * Consistent page-level description row used under the AppShell TopBar title.
 */
export function PageHeader({
  description,
  action,
  aside,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {aside && (
          <p className="text-xs text-muted-foreground sm:hidden">{aside}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {aside && (
          <p className="hidden text-xs text-muted-foreground sm:block">
            {aside}
          </p>
        )}
        {action}
      </div>
    </div>
  )
}
