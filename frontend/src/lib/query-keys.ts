import type { VocabPageParams } from "@/lib/api"

/**
 * Central React Query key factory. Prefix arrays stay stable so
 * `invalidateQueries({ queryKey: queryKeys.vocab.all })` still fans out.
 */
export const queryKeys = {
  vocab: {
    all: ["vocab"] as const,
    summary: () => ["vocab", "summary"] as const,
    nextReview: (limit = 5) => ["vocab", "next-review", limit] as const,
    words: (params: VocabPageParams) =>
      [
        "vocab",
        "words",
        params.page,
        params.pageSize,
        params.search ?? "",
        params.lastResponse ?? "ALL",
        params.masteryTier ?? "ALL",
        params.tag ?? "",
        params.minWeakScore ?? null,
        params.sort ?? "",
      ] as const,
    /** Full in-memory word index (ArticleDetail popovers). Prefer page keys. */
    allWords: () => ["vocab", "words"] as const,
    weak: (
      params: Pick<
        VocabPageParams,
        "pageSize" | "lastResponse" | "tag" | "sort"
      > & { infinite?: boolean }
    ) =>
      [
        "vocab",
        "weak",
        params.pageSize,
        params.lastResponse ?? "ALL",
        params.tag ?? "",
        params.sort ?? "",
        params.infinite ? "infinite" : "page",
      ] as const,
  },
  articles: {
    all: ["articles"] as const,
    list: () => ["articles", "list"] as const,
    recent: (limit = 5) => ["articles", "recent", limit] as const,
    firstUnread: () => ["articles", "first-unread"] as const,
    detail: (id: string) => ["articles", id] as const,
  },
  generate: {
    all: ["generate"] as const,
    preview: (rawIds: string, count: number) =>
      ["generate", "preview", rawIds, count] as const,
  },
} as const
