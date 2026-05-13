import type { ReactNode } from "react"

import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Trend } from "@/types/api"

export type StatCardTone = "default" | "accent" | "warning"

const toneStyles: Record<StatCardTone, { icon: string; ring: string }> = {
  default: { icon: "bg-muted text-foreground", ring: "ring-foreground/10" },
  accent: { icon: "bg-foreground text-background", ring: "ring-foreground/15" },
  warning: {
    icon: "bg-destructive/10 text-destructive",
    ring: "ring-destructive/20",
  },
}

const trendToneStyles: Record<NonNullable<Trend["tone"]>, string> = {
  positive: "text-emerald-700 dark:text-emerald-400",
  negative: "text-rose-700 dark:text-rose-400",
  neutral: "text-muted-foreground",
}

export interface StatCardProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon: IconSvgElement
  tone?: StatCardTone
  footer?: ReactNode
  /** Optional trend badge rendered under the value. */
  trend?: Trend
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  footer,
  trend,
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
        <div className="flex items-baseline gap-2">
          <div className="font-heading text-3xl font-semibold tracking-tight tabular-nums">
            {value}
          </div>
          {trend && <TrendPill trend={trend} />}
        </div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
      {footer && <div className="px-4 pb-1">{footer}</div>}
    </Card>
  )
}

function TrendPill({ trend }: { trend: Trend }) {
  const sign = trend.value > 0 ? "+" : trend.value < 0 ? "−" : "±"
  const tone: NonNullable<Trend["tone"]> = trend.tone ?? "neutral"
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-0.5 text-[11px] font-medium tabular-nums",
        trendToneStyles[tone],
      )}
      aria-label={`${trend.label} ${sign}${Math.abs(trend.value)}`}
    >
      <HugeiconsIcon
        icon={trend.value >= 0 ? ArrowUp01Icon : ArrowDown01Icon}
        size={10}
        strokeWidth={2}
        className="translate-y-0.5"
      />
      {sign}
      {Math.abs(trend.value)}
    </span>
  )
}
