import { weakScoreTier, WEAK_SCORE_MAX } from "@/lib/weak-score"
import { cn } from "@/lib/utils"

/**
 * Renders `weak_score`. The 薄弱词 page leads with this metric (whereas 全部单词
 * leads with `mastery_score`), so the two list views read as distinct lenses.
 * Tier logic lives in `lib/weak-score`.
 */
export interface WeakScoreMeterProps {
  score: number
  /**
   * `full` (default): a labelled bar + number, for table cells.
   * `compact`: a small tier dot + number, for tight right-aligned summaries.
   */
  variant?: "full" | "compact"
  className?: string
}

export function WeakScoreMeter({
  score,
  variant = "full",
  className,
}: WeakScoreMeterProps) {
  const tier = weakScoreTier(score)
  const pct = Math.max(6, Math.min(100, (score / WEAK_SCORE_MAX) * 100))
  const title = `weak ${score} · ${tier.label}weakness`

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
