import type { ArticleLength, CefrLevel } from "@/types/api"

export const MIN_TARGET_WORD_COUNT = 15
export const MAX_TARGET_WORD_COUNT = 80

/** One-click “this round” package size shared by 薄弱词 / Dashboard / 读完下一篇. */
export const RECOMMEND_COUNT = 20

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

export function parseCefrLevel(value: string | null | undefined): CefrLevel | null {
  if (value === "A2" || value === "B1" || value === "B2" || value === "C1") {
    return value
  }
  // Legacy / compound difficulties from older articles.
  if (value === "B1-B2") return "B1"
  return null
}

export function parseArticleLength(
  value: string | null | undefined
): ArticleLength | null {
  if (value === "short" || value === "medium" || value === "long") return value
  return null
}

export interface GeneratePathOptions {
  targetWordIds?: string[]
  /** When set (and no explicit ids), ArticleNew fetches top-N weak words. */
  autoRecommend?: number
  topic?: string
  difficulty?: string
  length?: ArticleLength
}

/** Build `/articles/new` deep link with optional prefill + recommend package. */
export function buildGeneratePath(options: GeneratePathOptions = {}): string {
  const params = new URLSearchParams()
  if (options.targetWordIds && options.targetWordIds.length > 0) {
    params.set("target_word_ids", options.targetWordIds.join(","))
  } else if (options.autoRecommend && options.autoRecommend > 0) {
    params.set(
      "auto_recommend",
      String(
        clamp(options.autoRecommend, 1, MAX_TARGET_WORD_COUNT)
      )
    )
  }
  const topic = options.topic?.trim()
  if (topic) params.set("topic", topic)
  if (options.difficulty) params.set("difficulty", options.difficulty)
  if (options.length) params.set("length", options.length)
  const qs = params.toString()
  return qs ? `/articles/new?${qs}` : "/articles/new"
}
