import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearAccessToken, getAccessToken } from "@/lib/access-token"

import { api } from "./api"

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
})
