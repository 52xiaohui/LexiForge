import type {
  Article,
  ArticleDetail,
  ArticleLength,
  ArticleProgress,
  ArticleWord,
  GenerateArticleInput,
  GenerationPreview,
  LastResponse,
  MasteryTierId,
  Page,
  SyncResult,
  VocabSummary,
  VocabWord,
} from "@/types/api"
import {
  clearAccessToken,
  getAccessToken,
  notifyAccessTokenRejected,
  setAccessToken,
} from "@/lib/access-token"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8080/api/v1"

interface APIErrorBody {
  code?: string
  message?: string
  details?: unknown
}

export class AccessDeniedError extends Error {
  constructor(message = "A valid LexiForge access token is required.") {
    super(message)
    this.name = "AccessDeniedError"
  }
}

export function isAccessDeniedError(
  error: unknown
): error is AccessDeniedError {
  return error instanceof AccessDeniedError
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
  recommendation_score?: number
  recommendation_version?: string
  recommendation_reasons?: Record<string, number>
  next_study_date: string | null
  ignored?: boolean
  pinned?: boolean
  recognized?: boolean
  mastered?: boolean
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
  article_length?: ArticleLength
  summary?: string
  target_word_count: number
  covered_word_count: number
  coverage_rate: number
  generation_status?: string
  model_name?: string
  generation_attempts?: number
  generation_duration_ms?: number
  input_tokens?: number
  output_tokens?: number
  created_at?: string
  progress_status?: BackendArticleProgress["status"] | null
  progress_percent?: number
  last_paragraph_index?: number | null
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
    study_record_id?: string | null
    last_response?: string
    study_count?: number
    mastery_score?: number
    weak_score?: number
    recognized?: boolean
    mastered?: boolean
    ignored?: boolean
  }>
}

interface BackendArticleProgress {
  status: "unread" | "reading" | "read"
  progress_percent: number
  last_paragraph_index?: number | null
}

interface BackendGenerationPreview {
  words: BackendVocabRecord[]
  counts_by_response: Record<LastResponse, number>
  sticking_count: number
  auto_fill_count: number
  is_auto: boolean
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
    recommendation_score: record.recommendation_score,
    recommendation_version: record.recommendation_version,
    recommendation_reasons: record.recommendation_reasons,
    next_study_date: record.next_study_date,
    recognized: record.recognized ?? false,
    mastered: record.mastered ?? false,
    ignored: record.ignored ?? false,
  }
}

function mapArticle(
  item: BackendArticleListItem,
  progress?: BackendArticleProgress | null
): Article {
  const listProgress =
    progress ??
    (item.progress_status
      ? {
          status: item.progress_status,
          progress_percent: item.progress_percent ?? 0,
          last_paragraph_index: item.last_paragraph_index ?? null,
        }
      : null)
  return {
    id: item.id,
    title: item.title || "Untitled article",
    topic: item.topic,
    difficulty: item.difficulty as Article["difficulty"],
    article_length:
      item.article_length ?? inferArticleLength(item.target_word_count),
    target_word_count: item.target_word_count,
    covered_word_count: item.covered_word_count,
    coverage_rate: item.coverage_rate,
    generation_status: item.generation_status,
    generation_attempts: item.generation_attempts,
    generation_duration_ms: item.generation_duration_ms,
    input_tokens: item.input_tokens,
    output_tokens: item.output_tokens,
    created_at: item.created_at ?? new Date(0).toISOString(),
    read: listProgress?.status === "read",
    progress: listProgress ?? undefined,
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
    study_record_id: word.study_record_id ?? undefined,
    last_response: word.last_response
      ? normalizeLastResponse(word.last_response)
      : undefined,
    study_count: word.study_count,
    mastery_score: word.mastery_score,
    weak_score: word.weak_score,
    recognized: word.recognized ?? false,
    mastered: word.mastered ?? false,
    ignored: word.ignored ?? false,
  }
}

/**
 * Build a compact word index from article target words (with embedded
 * learning signals). Keys include both `word_id` and `study_record_id`.
 */
export function wordIndexFromArticleWords(
  words: ArticleWord[]
): Map<string, VocabWord> {
  const map = new Map<string, VocabWord>()
  for (const w of words) {
    const vw: VocabWord = {
      id: w.study_record_id ?? w.word_id,
      word_id: w.word_id,
      spelling: w.spelling,
      translation: w.translation,
      last_response: w.last_response ?? "VAGUE",
      study_count: w.study_count ?? 0,
      tags: [],
      mastery_score: w.mastery_score ?? 0,
      weak_score: w.weak_score ?? 0,
      next_study_date: null,
      recognized: w.recognized ?? false,
      mastered: w.mastered ?? false,
      ignored: w.ignored ?? false,
    }
    map.set(w.word_id, vw)
    if (w.study_record_id) map.set(w.study_record_id, vw)
  }
  return map
}

interface RequestOptions {
  accessToken?: string
  notifyOnUnauthorized?: boolean
}

function requestHeaders(
  init: RequestInit | undefined,
  accept: string,
  options?: RequestOptions
): Headers {
  const headers = new Headers(init?.headers)
  headers.set("Accept", accept)
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  const token = options?.accessToken ?? getAccessToken()
  if (token) headers.set("Authorization", `Bearer ${token}`)
  return headers
}

function handleUnauthorized(options?: RequestOptions): void {
  if (options?.notifyOnUnauthorized === false) return
  const hadToken = getAccessToken().length > 0
  clearAccessToken()
  if (hadToken) notifyAccessTokenRejected()
}

async function request<T>(
  path: string,
  init?: RequestInit,
  options?: RequestOptions
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: requestHeaders(init, "application/json", options),
  })

  if (!res.ok) {
    let body: APIErrorBody | null = null
    try {
      body = (await res.json()) as APIErrorBody
    } catch {
      // Keep the transport error readable when the backend returned no JSON.
    }
    const message = body?.message || body?.code || `HTTP ${res.status}`
    if (res.status === 401) {
      handleUnauthorized(options)
      throw new AccessDeniedError(message)
    }
    throw new Error(message)
  }

  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}

async function requestText(path: string, init?: RequestInit): Promise<string> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: requestHeaders(init, "text/markdown, text/plain;q=0.9, */*;q=0.8"),
  })

  if (!res.ok) {
    if (res.status === 401) {
      handleUnauthorized()
      throw new AccessDeniedError()
    }
    throw new Error(`HTTP ${res.status}`)
  }
  return res.text()
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

  return items.map(mapWord)
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
    items: page.items.map(mapWord),
  }
}

export const api = {
  async checkSession(): Promise<void> {
    await request<{ status: string }>("/session")
  },

  async unlock(token: string): Promise<void> {
    const normalized = token.trim()
    await request<{ status: string }>("/session", undefined, {
      accessToken: normalized,
      notifyOnUnauthorized: false,
    })
    setAccessToken(normalized)
  },

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
    return page.items.map((item) => mapArticle(item))
  },

  async firstUnreadArticle(): Promise<Article | null> {
    const articles = await api.listArticles()
    return articles.find((article) => !article.read) ?? articles[0] ?? null
  },

  async getArticle(id: string): Promise<ArticleDetail | null> {
    const [detail, progress] = await Promise.all([
      request<BackendArticleDetail>(`/articles/${id}`),
      request<BackendArticleProgress>(`/articles/${id}/progress`),
    ])
    return {
      ...mapArticle(detail.article, progress),
      content_markdown: detail.article.content_markdown,
      article_words: detail.words.map(mapArticleWord),
    }
  },

  async getArticleProgress(id: string): Promise<ArticleProgress> {
    return request<BackendArticleProgress>(`/articles/${id}/progress`)
  },

  async updateArticleProgress(
    id: string,
    input: {
      status?: ArticleProgress["status"]
      progress_percent?: number
      last_paragraph_index?: number | null
    }
  ): Promise<ArticleProgress> {
    return request<BackendArticleProgress>(`/articles/${id}/progress`, {
      method: "PUT",
      body: JSON.stringify(input),
    })
  },

  async deleteArticle(id: string): Promise<void> {
    await request<void>(`/articles/${id}`, { method: "DELETE" })
  },

  async exportArticleMarkdown(id: string): Promise<string> {
    return requestText(`/articles/${id}/export.md`)
  },

  async generateArticle(
    input: GenerateArticleInput
  ): Promise<{ article_id: string }> {
    return request<{ article_id: string }>("/articles/generate", {
      method: "POST",
      body: JSON.stringify(input),
    })
  },

  async regenerateArticle(id: string): Promise<{ article_id: string }> {
    return request<{ article_id: string }>(`/articles/${id}/regenerate`, {
      method: "POST",
    })
  },

  async syncMaimemo(): Promise<SyncResult> {
    return request<SyncResult>("/sync/maimemo", { method: "POST" })
  },

  async generationPreview(
    selectedIds: string[],
    targetCount: number
  ): Promise<GenerationPreview> {
    const preview = await request<BackendGenerationPreview>(
      "/articles/preview",
      {
        method: "POST",
        body: JSON.stringify({
          target_word_count: targetCount,
          target_word_ids: selectedIds,
        }),
      }
    )
    return {
      ...preview,
      words: preview.words.map(mapWord),
    }
  },

  async markArticleRead(id: string): Promise<boolean> {
    await api.updateArticleProgress(id, { status: "read" })
    return true
  },

  async markWordMastered(
    wordId: string,
    mastered: boolean,
    articleId?: string
  ): Promise<boolean> {
    if (!mastered) return true
    await request("/word-events", {
      method: "POST",
      body: JSON.stringify({
        word_id: wordId,
        article_id: articleId,
        event_type: "manually_mastered",
        source: "manual",
        metadata: {},
      }),
    })
    return true
  },

  async markWordRecognized(
    wordId: string,
    recognized: boolean,
    articleId?: string
  ): Promise<boolean> {
    await request("/word-events", {
      method: "POST",
      body: JSON.stringify({
        word_id: wordId,
        article_id: articleId,
        event_type: recognized ? "recognized_in_context" : "failed_in_context",
        source: "reader",
        metadata: {},
      }),
    })
    return true
  },

  async markWordIgnored(recordId: string, ignored: boolean): Promise<boolean> {
    await request(`/vocab/${recordId}/preferences`, {
      method: "PUT",
      body: JSON.stringify({
        ignored,
        ignored_reason: ignored ? "not_relevant" : null,
        ignored_until: null,
        pinned: false,
      }),
    })
    return true
  },
}
