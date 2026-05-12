import { Badge } from "@/components/ui/badge"
import { formatLastResponse } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import type { LastResponse } from "@/types/api"

const responseStyles: Record<LastResponse, string> = {
  WELL_FAMILIAR:
    "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
  FAMILIAR:
    "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-400",
  VAGUE:
    "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400",
  FORGET:
    "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-400",
}

export interface LastResponseBadgeProps {
  value: LastResponse
  className?: string
}

export function LastResponseBadge({ value, className }: LastResponseBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("h-5 px-1.5 text-[10px]", responseStyles[value], className)}
    >
      {formatLastResponse(value)}
    </Badge>
  )
}
