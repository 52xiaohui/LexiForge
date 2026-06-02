/**
 * `mastery_score` (0–100) is the positive counterpart to `weak_score`: higher
 * means the word is closer to being owned. Shared tier logic lives here (rather
 * than in MasteryMeter.tsx) so non-component files can import it without
 * tripping the react-refresh "components-only export" rule.
 */
export const MASTERY_SCORE_MAX = 100

export type MasteryTierId = "mastered" | "learning" | "starting"

export interface MasteryTier {
  id: MasteryTierId
  /** Inclusive lower bound. */
  min: number
  label: string
  bar: string
  text: string
}

// Ordered high → low; the first matching `min` wins.
export const MASTERY_TIERS: MasteryTier[] = [
  {
    id: "mastered",
    min: 80,
    label: "已掌握",
    bar: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "learning",
    min: 45,
    label: "巩固中",
    bar: "bg-primary",
    text: "text-primary",
  },
  {
    id: "starting",
    min: 0,
    label: "起步",
    bar: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
  },
]

export function masteryTier(score: number): MasteryTier {
  return (
    MASTERY_TIERS.find((t) => score >= t.min) ??
    MASTERY_TIERS[MASTERY_TIERS.length - 1]!
  )
}

export function masteryTierFor(score: number): MasteryTierId {
  return masteryTier(score).id
}
