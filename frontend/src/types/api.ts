// Domain types mirroring docs/04-api.md response shapes.
// MVP scope — extend when wiring real endpoints.

export type CefrLevel = "A2" | "B1" | "B2" | "C1"

export type LastResponse = "FAMILIAR" | "WELL_FAMILIAR" | "VAGUE" | "FORGET"

export type ArticleLength = "short" | "medium" | "long"

export type Difficulty = CefrLevel | "B1-B2"

/** Trend tag rendered by StatCards — +/- absolute value over a period. */
export interface Trend {
  /** Signed delta; positive is up, negative is down. */
  value: number
  /** Human-readable comparison window, e.g. "vs 上周". */
  label: string
  /** Semantic colour hint — "positive" is good news, "negative" is bad. */
  tone?: "positive" | "negative" | "neutral"
}

export interface VocabSummary {
  total: number
  weak: number
  last_synced_at: string | null
  sticking_count?: number
  next_study_due_count?: number
  by_last_response?: Partial<Record<LastResponse, number>>
  by_mastery_tier?: Record<MasteryTierId, number>
  /** Trend vs last week, drives the Dashboard total-words StatCard. */
  total_trend?: Trend
  /** Trend vs last week, drives the Dashboard weak-words StatCard. */
  weak_trend?: Trend
}

export interface TodayProgress {
  practiced: number
  target: number
  /** Current study streak — consecutive days hitting the daily target. */
  streak_days?: number
}

/** Full vocabulary record for /vocab. */
export interface VocabWord {
  id: string
  /** Backend vocab_words id. `id` remains the study_records id for generation selection. */
  word_id?: string
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
  /**
   * Lighter-weight flag than `mastered`: the user signalled "I recognised this
   * inside an article" without committing to full mastery. Lets us show a
   * gentler highlight in the reader and feeds back into weak-score tuning.
   */
  recognized?: boolean
  /** User flag — word manually ignored for selection, hides from the weak list. */
  ignored?: boolean
  /** Up to ~3 synonyms surfaced in the word popover. */
  synonyms?: string[]
  /** Optional short etymology / word-root gloss (roots, prefix, cognates). */
  root_note?: string
  /** Article IDs that targeted this word — populated by mock store. */
  related_article_ids?: string[]
}

/** Weak word — same shape as VocabWord but with guaranteed weak_score. */
export type WeakWord = VocabWord

export type MasteryTierId = "mastered" | "learning" | "starting"

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

export interface SyncResult {
  status: string
  records_total: number
  records_fetched?: number
  records_unavailable?: number
  records_inserted: number
  records_updated: number
  duration_ms: number
  cached?: boolean
  warning?: string
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
   * failure branch in the prototype. Hidden behind `import.meta.env.DEV`.
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
