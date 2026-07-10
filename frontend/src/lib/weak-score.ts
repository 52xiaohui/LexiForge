/**
 * `weak_score` (from Maimemo) spans roughly 16–164 in practice. Shared tier
 * logic lives here so non-component files can import it without tripping the
 * react-refresh "components-only export" rule.
 */
export const WEAK_SCORE_MAX = 160

export type WeakScoreTierId = "high" | "mid" | "low"

export interface WeakScoreTier {
  id: WeakScoreTierId
  /** Inclusive lower bound. */
  min: number
  label: string
  bar: string
  text: string
}

// Ordered high → low; the first matching `min` wins.
export const WEAK_SCORE_TIERS: WeakScoreTier[] = [
  {
    id: "high",
    min: 120,
    label: "高",
    bar: "bg-destructive",
    text: "text-destructive",
  },
  {
    id: "mid",
    min: 70,
    label: "中",
    bar: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
  {
    id: "low",
    min: 0,
    label: "低",
    bar: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
]

export function weakScoreTier(score: number): WeakScoreTier {
  return (
    WEAK_SCORE_TIERS.find((t) => score >= t.min) ??
    WEAK_SCORE_TIERS[WEAK_SCORE_TIERS.length - 1]!
  )
}
