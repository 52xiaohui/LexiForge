import type { ArticleLength } from "@/types/api"

export const MIN_TARGET_WORD_COUNT = 15
export const MAX_TARGET_WORD_COUNT = 80

export const lengthMedian: Record<ArticleLength, number> = {
  short: 20,
  medium: 33,
  long: 60,
}

export function recommendArticleLength(n: number): ArticleLength {
  if (n <= 25) return "short"
  if (n <= 40) return "medium"
  return "long"
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}
