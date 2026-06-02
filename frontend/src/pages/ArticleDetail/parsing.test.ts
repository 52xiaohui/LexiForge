import { describe, expect, it } from "vitest"

import type { ArticleWord } from "@/types/api"

import {
  locatedTargets,
  paragraphDomId,
  parseArticle,
  sentenceDomId,
  targetDomId,
} from "./parsing"

/** Build an ArticleWord pointing at the first code-point occurrence of `spelling`. */
function wordAt(
  body: string,
  spelling: string,
  overrides: Partial<ArticleWord> = {},
): ArticleWord {
  const char_offset = Array.from(body).join("").indexOf(spelling)
  return {
    word_id: `w_${spelling}`,
    spelling,
    translation: "",
    char_offset,
    char_length: Array.from(spelling).length,
    is_covered: char_offset >= 0,
    ...overrides,
  }
}

describe("parseArticle", () => {
  it("splits paragraphs on runs of two-or-more newlines", () => {
    const body = "First para. Still first.\n\nSecond para.\n\n\nThird para."
    const { paragraphs } = parseArticle(body, [])
    expect(paragraphs).toHaveLength(3)
    expect(paragraphs.map((p) => p.idx)).toEqual([0, 1, 2])
  })

  it("does not split on a single newline", () => {
    const body = "Line one.\nLine two."
    const { paragraphs } = parseArticle(body, [])
    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0]!.sentences).toHaveLength(2)
  })

  it("splits sentences on . ! and ? and keeps terminators", () => {
    const body = "Hi there. Are you ok? Yes!"
    const { sentences } = parseArticle(body, [])
    expect(sentences.map((s) => s.text)).toEqual([
      "Hi there.",
      "Are you ok?",
      "Yes!",
    ])
  })

  it("assigns globally unique, sequential sentence indices across paragraphs", () => {
    const body = "A. B.\n\nC. D."
    const { sentences } = parseArticle(body, [])
    expect(sentences.map((s) => s.globalIdx)).toEqual([0, 1, 2, 3])
    expect(sentences.map((s) => s.paragraphIdx)).toEqual([0, 0, 1, 1])
    expect(sentences.map((s) => s.withinParagraphIdx)).toEqual([0, 1, 0, 1])
  })

  it("inlines target words as `target` segments and leaves the rest as text", () => {
    const body = "The ephemeral moment passed."
    const { sentences } = parseArticle(body, [wordAt(body, "ephemeral")])
    const segs = sentences[0]!.segments
    const target = segs.find((s) => s.kind === "target")
    expect(target?.text).toBe("ephemeral")
    expect(target?.word?.word_id).toBe("w_ephemeral")
    // Reconstructing the segments yields the original sentence text.
    expect(segs.map((s) => s.text).join("")).toBe("The ephemeral moment passed.")
  })

  it("ignores target words with negative offset (unlocated)", () => {
    const body = "No targets here."
    const { sentences } = parseArticle(body, [
      wordAt(body, "missing", { char_offset: -1, char_length: 7 }),
    ])
    expect(sentences[0]!.segments.every((s) => s.kind === "text")).toBe(true)
  })
})

describe("locatedTargets", () => {
  it("keeps only covered, located targets and sorts them by offset", () => {
    const words: ArticleWord[] = [
      { word_id: "b", spelling: "b", translation: "", char_offset: 40, char_length: 1, is_covered: true },
      { word_id: "a", spelling: "a", translation: "", char_offset: 10, char_length: 1, is_covered: true },
      { word_id: "x", spelling: "x", translation: "", char_offset: 20, char_length: 1, is_covered: false },
      { word_id: "y", spelling: "y", translation: "", char_offset: -1, char_length: 1, is_covered: true },
    ]
    expect(locatedTargets(words).map((w) => w.word_id)).toEqual(["a", "b"])
  })

  it("does not mutate the input array", () => {
    const words: ArticleWord[] = [
      { word_id: "b", spelling: "b", translation: "", char_offset: 40, char_length: 1, is_covered: true },
      { word_id: "a", spelling: "a", translation: "", char_offset: 10, char_length: 1, is_covered: true },
    ]
    locatedTargets(words)
    expect(words.map((w) => w.word_id)).toEqual(["b", "a"])
  })
})

describe("dom id helpers", () => {
  it("build stable, namespaced ids", () => {
    expect(targetDomId("art_1", "w_9")).toBe("target-art_1-w_9")
    expect(paragraphDomId("art_1", 2)).toBe("para-art_1-2")
    expect(sentenceDomId("art_1", 5)).toBe("sent-art_1-5")
  })
})
