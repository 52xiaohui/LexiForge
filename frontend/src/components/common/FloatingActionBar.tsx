import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export interface FloatingActionBarProps {
  children: ReactNode
  /**
   * Visual tone for the border/ring. Use `destructive` when validation fails
   * or selection exceeds a hard limit.
   */
  tone?: "default" | "destructive"
  /**
   * `always` — fixed bottom bar on every breakpoint (VocabWeak selection).
   * `mobile` — only below `lg` (ArticleNew sticky CTA).
   */
  visibility?: "always" | "mobile"
  className?: string
  contentClassName?: string
}

/**
 * Shared sticky bottom action surface used by selection flows (薄弱词) and
 * generation (生成文章). Owns safe-area padding, blur chrome, and danger tone.
 */
export function FloatingActionBar({
  children,
  tone = "default",
  visibility = "always",
  className,
  contentClassName,
}: FloatingActionBarProps) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4",
        visibility === "mobile" && "lg:hidden",
        className
      )}
      style={{
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        paddingTop: "0.5rem",
      }}
    >
      <div
        className={cn(
          "pointer-events-auto flex w-full max-w-3xl items-center gap-3 rounded-3xl border bg-background/95 p-3 pl-5 shadow-lg ring-1 backdrop-blur supports-backdrop-filter:bg-background/70",
          tone === "destructive"
            ? "border-destructive/40 ring-destructive/20"
            : "border-border/60 ring-foreground/5",
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  )
}
