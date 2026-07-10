import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface StickingBadgeProps {
  className?: string
}

/** Tag for words repeatedly forgotten (Maimemo STICKING). */
export function StickingBadge({ className }: StickingBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("h-5 px-1.5 text-[10px]", className)}
    >
      反复忘
    </Badge>
  )
}
