import type { ArticleWord } from "@/types/api"

/**
 * Building blocks for the reading surface. The article body is parsed once
 * into a paragraph → sentence → segment tree so every downstream feature
 * (highlighting, TTS karaoke, paragraph self-assessment, target-dot rail)
 * works off a single shared structure rather than re-tokenising the body.
 *
 * Offsets are Unicode code-point indices to match the backend contract — the
 * mock store and the real `article_words` rows agree on `char_offset`.
 */

/** Plain text run, or a target-word run keyed back to its `ArticleWord`. */
export interface Segment {
  kind: "text" | "target"
  text: string
  /** Code-point offset of this segment within the article body. */
  start: number
  /** Code-point offset of the first code point AFTER this segment. */
  end: number
  /** Populated only for target segments. */
  word?: ArticleWord
}

export interface Sentence {
  /** Unique index across the whole article. */
  globalIdx: number
  /** Index of the parent paragraph (0-based). */
  paragraphIdx: number
  /** Index of this sentence within its parent paragraph. */
  withinParagraphIdx: number
  /** Code-point span of the sentence in the article body. */
  start: number
  end: number
  /** Plain-text reconstruction — used by TTS and the Review condensed view. */
  text: string
  segments: Segment[]
}

export interface Paragraph {
  /** Index of this paragraph within the article. */
  idx: number
  start: number
  end: number
  sentences: Sentence[]
}

export interface ParsedArticle {
  paragraphs: Paragraph[]
  /** Flat sentence list for karaoke / review iteration. */
  sentences: Sentence[]
}

/**
 * Slice the article body into paragraph → sentence → segment runs.
 *
 * - Paragraphs split on a run of two-or-more newlines (matches the existing
 *   markdown convention used by the mock store seeds).
 * - Sentences split on `.`, `?`, `!`, including their trailing whitespace, so
 *   the TTS engine speaks naturally and the karaoke highlight covers the
 *   punctuation as well.
 * - Targets come from `article_words` and are inlined as `kind: "target"`
 *   segments. Overlapping targets resolve to the first registered one.
 */
export function parseArticle(
  body: string,
  words: ArticleWord[],
): ParsedArticle {
  const codepoints = Array.from(body)
  const totalLen = codepoints.length

  // 1. Build a sorted, non-overlapping list of target segments.
  const marks = words
    .filter((w) => w.char_offset >= 0 && w.char_length > 0)
    .slice()
    .sort((a, b) => a.char_offset - b.char_offset)

  // 2. Walk paragraph boundaries by scanning for runs of two-or-more `\n`.
  const paragraphs: Paragraph[] = []
  let cursor = 0
  while (cursor < totalLen) {
    // Skip leading newlines that aren't part of a paragraph.
    while (cursor < totalLen && codepoints[cursor] === "\n") cursor++
    if (cursor >= totalLen) break
    const paraStart = cursor
    let paraEnd = cursor
    while (paraEnd < totalLen) {
      if (codepoints[paraEnd] === "\n") {
        // Look ahead for a second newline → paragraph boundary.
        let lookahead = paraEnd + 1
        while (lookahead < totalLen && codepoints[lookahead] === "\n")
          lookahead++
        if (lookahead - paraEnd >= 2) {
          break
        }
      }
      paraEnd++
    }
    const idx = paragraphs.length
    paragraphs.push({
      idx,
      start: paraStart,
      end: paraEnd,
      sentences: buildSentences(codepoints, paraStart, paraEnd, marks, idx),
    })
    cursor = paraEnd
    while (cursor < totalLen && codepoints[cursor] === "\n") cursor++
  }

  // 3. Re-index sentences globally and flatten.
  const sentences: Sentence[] = []
  for (const p of paragraphs) {
    for (const s of p.sentences) {
      s.globalIdx = sentences.length
      sentences.push(s)
    }
  }

  return { paragraphs, sentences }
}

/**
 * Slice a paragraph into sentences plus segments. Sentence terminators stick
 * to the preceding sentence so TTS gets the punctuation cue.
 */
function buildSentences(
  codepoints: string[],
  paraStart: number,
  paraEnd: number,
  marks: ArticleWord[],
  paragraphIdx: number,
): Sentence[] {
  const result: Sentence[] = []
  let cursor = paraStart

  while (cursor < paraEnd) {
    // Skip leading whitespace (preserve internal newlines as part of the body
    // text — paragraph splitting already removed the double-newline boundary).
    while (cursor < paraEnd && /\s/.test(codepoints[cursor]!)) cursor++
    if (cursor >= paraEnd) break

    const sentStart = cursor
    let sentEnd = cursor
    while (sentEnd < paraEnd) {
      const ch = codepoints[sentEnd]!
      if (ch === "." || ch === "!" || ch === "?") {
        // Consume runs of terminators (e.g. "?!") + trailing whitespace.
        sentEnd++
        while (
          sentEnd < paraEnd &&
          (codepoints[sentEnd] === "." ||
            codepoints[sentEnd] === "!" ||
            codepoints[sentEnd] === "?" ||
            codepoints[sentEnd] === '"' ||
            codepoints[sentEnd] === "'" ||
            codepoints[sentEnd] === ")" ||
            codepoints[sentEnd] === "]")
        )
          sentEnd++
        // Eat the trailing space so the next sentence starts cleanly.
        while (sentEnd < paraEnd && codepoints[sentEnd] === " ") sentEnd++
        break
      }
      sentEnd++
    }
    if (sentEnd === sentStart) break

    const text = codepoints.slice(sentStart, sentEnd).join("").trim()
    if (text.length > 0) {
      result.push({
        globalIdx: -1,
        paragraphIdx,
        withinParagraphIdx: result.length,
        start: sentStart,
        end: sentEnd,
        text,
        segments: buildSegments(codepoints, sentStart, sentEnd, marks),
      })
    }
    cursor = sentEnd
  }

  return result
}

/**
 * Slice the [start, end) range of a code-point array into text + target
 * segments using the pre-sorted `marks` list. Targets that fall entirely
 * outside the range are ignored; targets that straddle the boundary are
 * skipped (a sentence boundary inside a target is impossible in practice
 * because we split on `.!?` only).
 */
function buildSegments(
  codepoints: string[],
  start: number,
  end: number,
  marks: ArticleWord[],
): Segment[] {
  const segments: Segment[] = []
  let cursor = start
  for (const mark of marks) {
    const markEnd = mark.char_offset + mark.char_length
    if (markEnd <= start) continue
    if (mark.char_offset >= end) break
    if (mark.char_offset < cursor) continue // skip overlapping
    if (mark.char_offset > cursor) {
      segments.push({
        kind: "text",
        start: cursor,
        end: mark.char_offset,
        text: codepoints.slice(cursor, mark.char_offset).join(""),
      })
    }
    const segEnd = Math.min(markEnd, end)
    segments.push({
      kind: "target",
      start: mark.char_offset,
      end: segEnd,
      text: codepoints.slice(mark.char_offset, segEnd).join(""),
      word: mark,
    })
    cursor = segEnd
  }
  if (cursor < end) {
    segments.push({
      kind: "text",
      start: cursor,
      end,
      text: codepoints.slice(cursor, end).join(""),
    })
  }
  return segments
}

/**
 * Collect the located target words for an article in reading order.
 * Targets that the AI failed to embed (`is_covered = false`) are excluded —
 * this list drives the left-rail dots and the prev/next jump.
 */
export function locatedTargets(words: ArticleWord[]): ArticleWord[] {
  return words
    .filter((w) => w.is_covered && w.char_offset >= 0)
    .slice()
    .sort((a, b) => a.char_offset - b.char_offset)
}

export function targetDomId(articleId: string, wordId: string): string {
  return `target-${articleId}-${wordId}`
}

export function paragraphDomId(articleId: string, paragraphIdx: number): string {
  return `para-${articleId}-${paragraphIdx}`
}

export function sentenceDomId(articleId: string, sentenceIdx: number): string {
  return `sent-${articleId}-${sentenceIdx}`
}
