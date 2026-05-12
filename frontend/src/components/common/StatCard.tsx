import type { ReactNode } from "react"

import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type StatCardTone = "default" | "accent" | "warning"

const toneStyles: Record<StatCardTone, { icon: string; ring: string }> = {
  default: { icon: "bg-muted text-foreground", ring: "ring-foreground/10" },
  accent: { icon: "bg-foreground text-background", ring: "ring-foreground/15" },
  warning: {
    icon: "bg-destructive/10 text-destructive",
    ring: "ring-destructive/20",
  },
}

export interface StatCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon: IconSvgElement
  tone?: StatCardTone
  footer?: ReactNode
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  footer,
}: StatCardProps) {
  const styles = toneStyles[tone]
  return (
    <Card size="sm" className={cn(styles.ring)}>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            {label}
          </div>
          <div className={cn("grid size-8 place-items-center rounded-xl", styles.icon)}>
            <HugeiconsIcon icon={icon} size={15} strokeWidth={1.8} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="font-heading text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
      {footer && <div className="px-4 pb-1">{footer}</div>}
    </Card>
  )
}
