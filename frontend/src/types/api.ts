// Domain types mirroring docs/04-api.md response shapes.
// MVP scope — extend when wiring real endpoints.

export type CefrLevel = "A2" | "B1" | "B2" | "C1"

export type LastResponse = "FAMILIAR" | "WELL_FAMILIAR" | "VAGUE" | "FORGET"

export type ArticleLength = "short" | "medium" | "long"

export type Difficulty = CefrLevel | "B1-B2"

export interface VocabSummary {
  total: number
  weak: number
  last_synced_at: string | null
}

export interface TodayProgress {
  practiced: number
  target: number
}

/** Full vocabulary record for /vocab. */
export interface VocabWord {
  id: string
  spelling: string
  translation: string
  last_response: LastResponse
  study_count: number
  tags: string[]
  mastery_score: number
  weak_score: number
  next_study_date: string | null
}

/** Weak word — same shape as VocabWord but with guaranteed weak_score. */
export type WeakWord = VocabWord

/** Article list item (no body). */
export interface Article {
  id: string
  title: string
  topic: string
  difficulty: Difficulty
  article_length: ArticleLength
  target_word_count: number
  covered_word_count: number
  coverage_rate: number
  created_at: string
}

/** Target word position inside an article body. */
export interface ArticleWord {
  word_id: string
  spelling: string
  translation: string
  /** Code-point offset (not byte offset). */
  char_offset: number
  /** Code-point length. */
  char_length: number
  is_covered: boolean
}

/** Full article detail as returned by GET /articles/:id. */
export interface ArticleDetail extends Article {
  content_markdown: string
  article_words: ArticleWord[]
}

/** POST /articles/generate request body. */
export interface GenerateArticleInput {
  topic: string
  difficulty: Difficulty
  target_word_count: number
  article_length: ArticleLength
  target_word_ids?: string[]
}

/** Paginated list response. */
export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}
