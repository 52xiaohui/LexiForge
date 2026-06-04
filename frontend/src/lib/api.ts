import type {
  Article,
  ArticleDetail,
  ArticleLength,
  ArticleWord,
  GenerateArticleInput,
  GenerationPreview,
  LastResponse,
  MasteryTierId,
  Page,
  SyncResult,
  TodayProgress,
  VocabSummary,
  VocabWord,
} from "@/types/api"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8080/api/v1"

const hiddenWordIds = new Set<string>()
const recognizedWordIds = new Set<string>()
const readArticleIds = new Set<string>()
const WEAK_POOL_MIN_WEAK_SCORE = 50
const WEAK_POOL_MAX_MASTERY = 60

interface APIErrorBody {
  code?: string
  message?: string
  details?: unknown
}

interface BackendVocabRecord {
  id: string
  word_id: string
  spelling: string
  translation?: string
  last_response: LastResponse | "UNKNOWN" | string
  study_count: number
  tags: string[] | null
  mastery_score: number
  weak_score: number
  next_study_date: string | null
  synced_at?: string | null
}

interface BackendVocabSummary {
  total: number
  weak_count: number
  sticking_count?: number
  by_last_response?: Partial<Record<LastResponse, number>>
  by_mastery_tier?: Record<MasteryTierId, number>
  latest_synced_at: string | null
  next_study_due_count?: number
}

interface BackendArticleListItem {
  id: string
  title: string
  topic: string
  difficulty: string
  summary?: string
  target_word_count: number
  covered_word_count: number
  coverage_rate: number
  generation_status?: string
  model_name?: string
  created_at?: string
}

interface BackendArticleDetail {
  article: BackendArticleListItem & {
    content_markdown: string
    prompt_version?: string
  }
  words: Array<{
    word_id: string
    spelling: string
    translation?: string
    char_offset: number | null
    char_length: number | null
    is_covered: boolean
  }>
}

function inferArticleLength(targetWordCount: number): ArticleLength {
  if (targetWordCount <= 25) return "short"
  if (targetWordCount <= 40) return "medium"
  return "long"
}

function normalizeLastResponse(value: string): LastResponse {
  if (
    value === "FORGET" ||
    value === "VAGUE" ||
    value === "FAMILIAR" ||
    value === "WELL_FAMILIAR"
  ) {
    return value
  }
  return "VAGUE"
}

function mapWord(record: BackendVocabRecord): VocabWord {
  return {
    id: record.id,
    word_id: record.word_id,
    spelling: record.spelling,
    translation: record.translation ?? "",
    last_response: normalizeLastResponse(record.last_response),
    study_count: record.study_count,
    tags: record.tags ?? [],
    mastery_score: record.mastery_score,
    weak_score: record.weak_score,
    next_study_date: record.next_study_date,
    recognized:
      recognizedWordIds.has(record.id) || recognizedWordIds.has(record.word_id),
    mastered: hiddenWordIds.has(record.id) || hiddenWordIds.has(record.word_id),
    ignored: false,
    recently_covered_count: 0,
  }
}

function mapArticle(item: BackendArticleListItem): Article {
  return {
    id: item.id,
    title: item.title || "Untitled article",
    topic: item.topic,
    difficulty: item.difficulty as Article["difficulty"],
    article_length: inferArticleLength(item.target_word_count),
    target_word_count: item.target_word_count,
    covered_word_count: item.covered_word_count,
    coverage_rate: item.coverage_rate,
    created_at: item.created_at ?? new Date(0).toISOString(),
    read: readArticleIds.has(item.id),
  }
}

function mapArticleWord(
  word: BackendArticleDetail["words"][number]
): ArticleWord {
  return {
    word_id: word.word_id,
    spelling: word.spelling,
    translation: word.translation ?? "",
    char_offset: word.char_offset ?? -1,
    char_length: word.char_length ?? 0,
    is_covered: word.is_covered,
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  })

  if (!res.ok) {
    let body: APIErrorBody | null = null
    try {
      body = (await res.json()) as APIErrorBody
    } catch {
      // Keep the transport error readable when the backend returned no JSON.
    }
    throw new Error(body?.message || body?.code || `HTTP ${res.status}`)
  }

  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}

async function listWords(
  endpoint: "/vocab/records" | "/vocab/weak"
): Promise<VocabWord[]> {
  const pageSize = 200
  const items: BackendVocabRecord[] = []
  let pageNumber = 1
  let total = 0

  do {
    const page = await request<Page<BackendVocabRecord>>(
      `${endpoint}?page=${pageNumber}&page_size=${pageSize}`
    )
    items.push(...page.items)
    total = page.total
    pageNumber += 1
  } while (items.length < total)

  return items.map(mapWord).filter((w) => {
    return !hiddenWordIds.has(w.id) && !hiddenWordIds.has(w.word_id ?? "")
  })
}

export type VocabSort =
  | "spelling"
  | "-spelling"
  | "mastery_score"
  | "-mastery_score"
  | "study_count"
  | "-study_count"
  | "last_study_date"
  | "-last_study_date"
  | "next_study_date"
  | "-next_study_date"
  | "weak_score"
  | "-weak_score"

export interface VocabPageParams {
  page: number
  pageSize: number
  search?: string
  lastResponse?: LastResponse | "ALL"
  tag?: string
  minWeakScore?: number
  masteryTier?: MasteryTierId | "ALL"
  sort?: VocabSort
}

async function listWordsPage(
  endpoint: "/vocab/records" | "/vocab/weak",
  params: VocabPageParams
): Promise<Page<VocabWord>> {
  const query = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
  })
  const search = params.search?.trim()
  if (search) query.set("search", search)
  if (params.lastResponse && params.lastResponse !== "ALL") {
    query.set("last_response", params.lastResponse)
  }
  if (params.tag) query.set("tag", params.tag)
  if (params.minWeakScore != null) {
    query.set("min_weak_score", String(params.minWeakScore))
  }
  if (params.masteryTier && params.masteryTier !== "ALL") {
    query.set("mastery_tier", params.masteryTier)
  }
  if (params.sort) query.set("sort", params.sort)

  const page = await request<Page<BackendVocabRecord>>(
    `${endpoint}?${query.toString()}`
  )
  return {
    ...page,
    items: page.items.map(mapWord).filter((w) => {
      return !hiddenWordIds.has(w.id) && !hiddenWordIds.has(w.word_id ?? "")
    }),
  }
}

async function articleCreatedAtFromList(
  id: string
): Promise<string | undefined> {
  const page = await request<Page<BackendArticleListItem>>(
    "/articles?page_size=100"
  )
  return page.items.find((item) => item.id === id)?.created_at
}

function buildGenerationPreview(
  selectedIds: string[],
  targetCount: number,
  words: VocabWord[]
): GenerationPreview {
  const selected = selectedIds
    .map((id) => words.find((w) => w.id === id))
    .filter((w): w is VocabWord => Boolean(w))
  const seen = new Set(selected.map((w) => w.id))
  const pool = words
    .filter(
      (w) =>
        !seen.has(w.id) &&
        (w.weak_score >= WEAK_POOL_MIN_WEAK_SCORE ||
          w.mastery_score < WEAK_POOL_MAX_MASTERY)
    )
    .sort(
      (a, b) => b.weak_score - a.weak_score || a.mastery_score - b.mastery_score
    )
  const plan = [...selected, ...pool].slice(0, targetCount)

  const counts: Record<LastResponse, number> = {
    FORGET: 0,
    VAGUE: 0,
    FAMILIAR: 0,
    WELL_FAMILIAR: 0,
  }
  let sticking = 0
  for (const word of plan) {
    counts[word.last_response] += 1
    if (word.tags.includes("STICKING")) sticking += 1
  }

  return {
    words: plan,
    counts_by_response: counts,
    sticking_count: sticking,
    auto_fill_count: Math.max(0, plan.length - selected.length),
    is_auto: selected.length === 0,
  }
}

export const api = {
  async vocabSummary(): Promise<VocabSummary> {
    const summary = await request<BackendVocabSummary>("/vocab/summary")
    return {
      total: summary.total,
      weak: summary.weak_count,
      last_synced_at: summary.latest_synced_at,
      sticking_count: summary.sticking_count,
      by_last_response: summary.by_last_response,
      by_mastery_tier: summary.by_mastery_tier,
      next_study_due_count: summary.next_study_due_count,
    }
  },

  todayProgress(): TodayProgress {
    return { practiced: 0, target: 30, streak_days: 0 }
  },

  async listWords(): Promise<VocabWord[]> {
    return listWords("/vocab/records")
  },

  async listWordsPage(params: VocabPageParams): Promise<Page<VocabWord>> {
    return listWordsPage("/vocab/records", params)
  },

  async listWeakWords(): Promise<VocabWord[]> {
    return listWords("/vocab/weak")
  },

  async listWeakWordsPage(params: VocabPageParams): Promise<Page<VocabWord>> {
    return listWordsPage("/vocab/weak", params)
  },

  async nextReview(limit = 5): Promise<VocabWord[]> {
    const page = await api.listWeakWordsPage({
      page: 1,
      pageSize: limit,
      sort: "-weak_score",
    })
    return page.items
  },

  async listRecentArticles(limit = 5): Promise<Article[]> {
    const articles = await api.listArticles()
    return articles.slice(0, limit)
  },

  async listArticles(): Promise<Article[]> {
    const page = await request<Page<BackendArticleListItem>>(
      "/articles?page_size=100"
    )
    return page.items.map(mapArticle)
  },

  async firstUnreadArticle(): Promise<Article | null> {
    const articles = await api.listArticles()
    return articles.find((article) => !article.read) ?? articles[0] ?? null
  },

  async getArticle(id: string): Promise<ArticleDetail | null> {
    const detail = await request<BackendArticleDetail>(`/articles/${id}`)
    const createdAt =
      detail.article.created_at ?? (await articleCreatedAtFromList(id))
    return {
      ...mapArticle({ ...detail.article, created_at: createdAt }),
      content_markdown: detail.article.content_markdown,
      article_words: detail.words.map(mapArticleWord),
    }
  },

  async deleteArticle(id: string): Promise<void> {
    await request<void>(`/articles/${id}`, { method: "DELETE" })
  },

  async generateArticle(
    input: GenerateArticleInput
  ): Promise<{ article_id: string }> {
    return request<{ article_id: string }>("/articles/generate", {
      method: "POST",
      body: JSON.stringify(input),
    })
  },

  async syncMaimemo(): Promise<SyncResult> {
    return request<SyncResult>("/sync/maimemo", { method: "POST" })
  },

  async generationPreview(
    selectedIds: string[],
    targetCount: number
  ): Promise<GenerationPreview> {
    const words = await api.listWeakWords()
    return buildGenerationPreview(selectedIds, targetCount, words)
  },

  markArticleRead(id: string): boolean {
    readArticleIds.add(id)
    return true
  },

  markWordMastered(id: string, mastered: boolean): boolean {
    if (mastered) hiddenWordIds.add(id)
    else hiddenWordIds.delete(id)
    return true
  },

  markWordRecognized(id: string, recognized: boolean): boolean {
    if (recognized) recognizedWordIds.add(id)
    else recognizedWordIds.delete(id)
    return true
  },
}
