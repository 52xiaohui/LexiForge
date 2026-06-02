import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface SectionPanelProps {
  /** Heading content (usually an icon + label). */
  title: ReactNode
  /** Optional trailing action, e.g. a "查看全部" link. */
  action?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * A titled content block that reads as a flat, full-bleed grouped list on
 * phones and gains card chrome (border, ring, padding) from `sm` up. Lets the
 * Dashboard avoid "card-in-card" nesting on mobile — the list rows inside sit
 * directly on the page background instead of inside a second bordered box.
 */
export function SectionPanel({
  title,
  action,
  children,
  className,
}: SectionPanelProps) {
  return (
    <section
      className={cn(
        "sm:overflow-hidden sm:rounded-2xl sm:bg-card sm:py-6 sm:text-card-foreground sm:ring-1 sm:ring-foreground/10",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 pb-3 sm:border-b sm:px-6 sm:pb-4">
        <div className="flex items-center gap-2 font-heading text-base font-medium">
          {title}
        </div>
        {action}
      </div>
      <div className="sm:px-6 sm:pt-4">{children}</div>
    </section>
  )
}
