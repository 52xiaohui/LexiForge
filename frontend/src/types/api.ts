// Domain types mirroring docs/04-api.md response shapes.
// MVP scope only — extend when wiring real endpoints.

export type CefrLevel = "A2" | "B1" | "B2" | "C1"

export type LastResponse = "FAMILIAR" | "WELL_FAMILIAR" | "VAGUE" | "FORGET"

export type ArticleLength = "short" | "medium" | "long"

export interface VocabSummary {
  total: number
  weak: number
  last_synced_at: string | null
}

export interface WeakWord {
  id: string
  spelling: string
  last_response: LastResponse
  study_count: number
  tags: string[]
  mastery_score: number
  weak_score: number
  next_study_date: string | null
}

export interface Article {
  id: string
  title: string
  topic: string
  difficulty: CefrLevel
  article_length: ArticleLength
  target_word_count: number
  covered_word_count: number
  coverage_rate: number
  created_at: string
}

export interface TodayProgress {
  practiced: number
  target: number
}
