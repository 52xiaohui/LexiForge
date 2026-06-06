import {
  CheckmarkCircle02Icon,
  HelpCircleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export type ParagraphFeedbackValue = "ok" | "stuck"

export interface ParagraphFeedbackButtonsProps {
  value: ParagraphFeedbackValue | null
  onChange: (next: ParagraphFeedbackValue | null) => void
}

/**
 * Inline ✓ / ? affordance that lives right at the end of each paragraph.
 *
 * - Quiet by default (low-contrast, half opacity) so it doesn't compete with
 *   the reading flow.
 * - Becomes prominent once tapped, and tapping the same value again clears
 *   the assessment — toggle semantics rather than commit-only.
 */
export function ParagraphFeedbackButtons({
  value,
  onChange,
}: ParagraphFeedbackButtonsProps) {
  return (
    <div
      data-slot="paragraph-feedback"
      className={cn(
        "mt-1 flex items-center gap-1 text-muted-foreground transition-opacity",
        value ? "opacity-100" : "opacity-50 group-hover/paragraph:opacity-100",
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={value === "ok" ? "secondary" : "ghost"}
            size="icon-xs"
            aria-label="读懂了"
            aria-pressed={value === "ok"}
            onClick={() => onChange(value === "ok" ? null : "ok")}
            className={cn(
              value === "ok" && "text-emerald-600 dark:text-emerald-400",
            )}
          >
            <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={1.8} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>读懂了</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={value === "stuck" ? "secondary" : "ghost"}
            size="icon-xs"
            aria-label="没读懂"
            aria-pressed={value === "stuck"}
            onClick={() => onChange(value === "stuck" ? null : "stuck")}
            className={cn(
              value === "stuck" && "text-amber-600 dark:text-amber-400",
            )}
          >
            <HugeiconsIcon icon={HelpCircleIcon} strokeWidth={1.8} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>没读懂——稍后回顾</TooltipContent>
      </Tooltip>
    </div>
  )
}
