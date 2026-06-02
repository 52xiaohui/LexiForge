import { masteryTier, MASTERY_SCORE_MAX } from "@/lib/mastery"
import { cn } from "@/lib/utils"

/**
 * Renders `mastery_score` (0–100). The 全部单词 page leads with this metric
 * (whereas 薄弱词 leads with `weak_score`), so the two list views read as
 * distinct lenses on the same library rather than duplicate tables.
 *
 * Unlike WeakScoreMeter (a red→green risk scale), the fill grows with the
 * score so it reads as forward progress. Tier logic lives in `lib/mastery`.
 */
export interface MasteryMeterProps {
  score: number
  /**
   * `full` (default): a filled progress bar + number, for table cells.
   * `compact`: a small tier dot + number, for tight summaries / cards.
   */
  variant?: "full" | "compact"
  className?: string
}

export function MasteryMeter({
  score,
  variant = "full",
  className,
}: MasteryMeterProps) {
  const tier = masteryTier(score)
  const pct = Math.max(6, Math.min(100, (score / MASTERY_SCORE_MAX) * 100))
  const title = `掌握度 ${score} · ${tier.label}`

  if (variant === "compact") {
    return (
      <span
        className={cn("inline-flex items-center gap-1.5", className)}
        title={title}
      >
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full", tier.bar)}
        />
        <span className="font-heading text-sm tabular-nums">{score}</span>
      </span>
    )
  }

  return (
    <div className={cn("flex items-center gap-2", className)} title={title}>
      <div
        aria-hidden
        className="h-1.5 w-14 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full", tier.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("font-heading text-sm tabular-nums", tier.text)}>
        {score}
      </span>
    </div>
  )
}
