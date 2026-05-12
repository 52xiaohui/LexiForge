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
  /** Short contextual sentence used when the word is popped open in an article. */
  example_sentence?: string
  /** How many recent articles (last 30 days) targeted this word. */
  recently_covered_count?: number
  /** User flag — word manually marked as mastered, hides from the weak list. */
  mastered?: boolean
  /** User flag — word manually ignored for selection, hides from the weak list. */
  ignored?: boolean
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
  /** Client-side read flag (MVP) — backend spec may add this later. */
  read?: boolean
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
  /**
   * Mock-only — forces the next mutation to fail. Lets the workbench demo its
   * failure branch in the prototype.
   */
  simulate_failure?: boolean
}

/**
 * Pre-generation preview — summarises which weak words are likely to go into
 * the next article given the current parameters (either user-picked IDs or
 * auto-picked by the backend heuristic).
 */
export interface GenerationPreview {
  /** The target words the backend expects to receive. */
  words: VocabWord[]
  /** Breakdown by last_response for the plan (how many FORGET, VAGUE …). */
  counts_by_response: Record<LastResponse, number>
  /** How many of the plan entries are STICKING (repeatedly forgotten). */
  sticking_count: number
  /** How many slots will be auto-filled because the user picked too few words. */
  auto_fill_count: number
  /** True when the plan is fully auto-picked (no user IDs). */
  is_auto: boolean
}

/** Paginated list response. */
export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}
