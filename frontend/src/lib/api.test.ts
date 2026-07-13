import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearAccessToken, getAccessToken } from "@/lib/access-token"

import { api, wordIndexFromArticleWords } from "./api"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("api transport and generation contracts", () => {
  beforeEach(() => {
    clearAccessToken()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearAccessToken()
  })

  it("verifies and stores a session-only access token", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers)
        expect(headers.get("Authorization")).toBe("Bearer personal-secret")
        return jsonResponse({ status: "ok" })
      }
    )
    vi.stubGlobal("fetch", fetchMock)

    await api.unlock(" personal-secret ")
    expect(getAccessToken()).toBe("personal-secret")

    await api.checkSession()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("uses the snapshot-preserving regenerate endpoint", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toContain("/articles/article-1/regenerate")
        expect(init?.method).toBe("POST")
        return jsonResponse({ article_id: "article-2" })
      }
    )
    vi.stubGlobal("fetch", fetchMock)

    await expect(api.regenerateArticle("article-1")).resolves.toEqual({
      article_id: "article-2",
    })
  })

  it("uses the backend recommendation preview instead of a local approximation", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        expect(JSON.parse(String(init?.body))).toEqual({
          target_word_count: 15,
          target_word_ids: ["record-1"],
        })
        return jsonResponse({
          words: [
            {
              id: "record-1",
              word_id: "word-1",
              spelling: "durable",
              last_response: "FORGET",
              study_count: 8,
              tags: ["STICKING"],
              mastery_score: 20,
              weak_score: 120,
              next_study_date: null,
              recommendation_score: 155,
              recommendation_version: "v2",
              recommendation_reasons: { failed_in_context: 35 },
            },
          ],
          counts_by_response: {
            FORGET: 1,
            VAGUE: 0,
            FAMILIAR: 0,
            WELL_FAMILIAR: 0,
          },
          sticking_count: 1,
          auto_fill_count: 0,
          is_auto: false,
        })
      }
    )
    vi.stubGlobal("fetch", fetchMock)

    const preview = await api.generationPreview(["record-1"], 15)
    expect(preview.words[0]?.recommendation_score).toBe(155)
    expect(preview.words[0]?.recommendation_reasons).toEqual({
      failed_in_context: 35,
    })
  })

  it("maps article detail learning signals without a second vocab list fetch", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/progress")) {
        return jsonResponse({
          status: "reading",
          progress_percent: 10,
          last_paragraph_index: 0,
        })
      }
      return jsonResponse({
        article: {
          id: "article-1",
          title: "Test",
          topic: "campus",
          difficulty: "B1",
          article_length: "short",
          content_markdown: "Hello **stoic** world.",
          target_word_count: 1,
          covered_word_count: 1,
          coverage_rate: 1,
          created_at: "2026-07-10T12:00:00Z",
        },
        words: [
          {
            word_id: "word-1",
            spelling: "stoic",
            translation: "坚忍的",
            char_offset: 6,
            char_length: 5,
            is_covered: true,
            study_record_id: "record-1",
            last_response: "FORGET",
            study_count: 3,
            mastery_score: 20,
            weak_score: 110,
            recognized: true,
            mastered: false,
            ignored: false,
          },
        ],
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const detail = await api.getArticle("article-1")
    expect(detail?.created_at).toBe("2026-07-10T12:00:00Z")
    expect(detail?.article_words[0]?.weak_score).toBe(110)
    expect(detail?.article_words[0]?.recognized).toBe(true)

    const index = wordIndexFromArticleWords(detail!.article_words)
    expect(index.get("word-1")?.spelling).toBe("stoic")
    expect(index.get("record-1")?.weak_score).toBe(110)
    expect(index.get("word-1")?.recognized).toBe(true)
    // Only detail + progress — never a full vocab list.
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
