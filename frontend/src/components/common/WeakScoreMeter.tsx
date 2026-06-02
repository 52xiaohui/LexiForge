import { cn } from "@/lib/utils"

/**
 * `weak_score` (from Maimemo) spans roughly 16–164 in practice. The raw number
 * alone is hard to read at a glance, so we bucket it into three intuitive
 * tiers — 高 / 中 / 低 — and render a short colour-coded bar alongside the
 * number. The colour, not the digits, carries the "how weak is this word"
 * signal.
 */
const WEAK_SCORE_MAX = 160

interface Tier {
  /** Inclusive lower bound. */
  min: number
  label: string
  bar: string
  text: string
}

// Ordered high → low; the first matching `min` wins.
const TIERS: Tier[] = [
  { min: 120, label: "高", bar: "bg-destructive", text: "text-destructive" },
  {
    min: 70,
    label: "中",
    bar: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  {
    min: 0,
    label: "低",
    bar: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
]

function tierFor(score: number): Tier {
  return TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1]!
}

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
  const tier = tierFor(score)
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
    <div
      className={cn("flex items-center gap-2", className)}
      title={title}
    >
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
