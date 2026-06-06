import { Fragment, useEffect, useRef } from "react"

import { cn } from "@/lib/utils"
import type { ReadingFontFamily, ReadingFontSize } from "@/hooks/use-reading-prefs"
import type { VocabWord } from "@/types/api"

import {
  paragraphDomId,
  sentenceDomId,
  type Paragraph,
} from "../parsing"
import {
  ParagraphFeedbackButtons,
  type ParagraphFeedbackValue,
} from "./ParagraphFeedback"
import { TargetMark } from "./TargetMark"

// Per-mode body type. Values tuned for comfortable paragraph reading at each
// preset — leading grows slightly with size so long articles stay legible.
const FONT_SIZE_CLASS: Record<ReadingFontSize, string> = {
  sm: "text-[14px] leading-[1.85]",
  md: "text-[16px] leading-[1.9]",
  lg: "text-[18px] leading-[1.95]",
  xl: "text-[20px] leading-[2]",
}

export interface ArticleBodyProps {
  articleId: string
  paragraphs: Paragraph[]
  wordIndex: Map<string, VocabWord>
  fontSize: ReadingFontSize
  fontFamily: ReadingFontFamily
  tone: "default" | "sepia"
  challengeMode: boolean
  paragraphFeedbackEnabled: boolean

  /** globalIdx of the sentence currently being spoken by TTS, or null. */
  currentSentenceIdx: number | null

  /** Per-paragraph self-assessment map keyed by paragraph idx. */
  feedback: Record<number, ParagraphFeedbackValue>
  onFeedbackChange: (
    paragraphIdx: number,
    value: ParagraphFeedbackValue | null,
  ) => void

  onMaster: (wordId: string, spelling: string) => void
  onRecognize: (wordId: string, recognized: boolean) => void
  onSpeak: (text: string) => void

  /** Fires when a paragraph scrolls past 50% of the viewport. Used by the
   *  parent to ratchet forward the "last read" bookmark. */
  onParagraphReached?: (paragraphIdx: number) => void

  /** Optional sentinel ref the parent uses for "I read 80% of the article". */
  endSentinelRef?: React.Ref<HTMLDivElement>
}

/**
 * The rendered article surface — paragraphs of `<p data-slot="paragraph">`,
 * each containing inline `<span data-slot="sentence">`s. Targets are inlined
 * as `<TargetMark>`. Karaoke pulses the active sentence via `data-speaking`.
 */
export function ArticleBody({
  articleId,
  paragraphs,
  wordIndex,
  fontSize,
  fontFamily,
  tone,
  challengeMode,
  paragraphFeedbackEnabled,
  currentSentenceIdx,
  feedback,
  onFeedbackChange,
  onMaster,
  onRecognize,
  onSpeak,
  onParagraphReached,
  endSentinelRef,
}: ArticleBodyProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Observe paragraphs to feed the parent's "last read" tracker. We pick the
  // top-of-viewport intersection so a paragraph counts as "reached" once its
  // start crosses the fold, which mirrors the reader's actual position.
  useEffect(() => {
    if (!onParagraphReached) return undefined
    const root = containerRef.current
    if (!root) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const idxAttr = (e.target as HTMLElement).dataset.paragraphIdx
          const idx = idxAttr ? Number(idxAttr) : NaN
          if (Number.isFinite(idx)) onParagraphReached(idx)
        }
      },
      // Top quarter of the viewport — fires when a paragraph head crosses
      // ~25% from the top, a reasonable proxy for "now reading".
      { root: null, threshold: 0, rootMargin: "0px 0px -75% 0px" },
    )
    const targets = root.querySelectorAll<HTMLElement>("[data-paragraph-idx]")
    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [onParagraphReached, paragraphs])

  return (
    <article
      ref={containerRef}
      data-slot="article-body"
      data-tone={tone}
      className={cn(
        // The prose reads like a quiet sheet of paper instead of a dashboard
        // card. Phones keep the page open; larger screens get a subtle paper
        // surface without competing with the target-word interactions.
        "px-3 py-2 text-card-foreground",
        "sm:rounded-[1.75rem] sm:p-9 sm:ring-1 sm:ring-foreground/5",
        "sm:shadow-[0_24px_80px_color-mix(in_oklch,var(--color-foreground)_8%,transparent)]",
        FONT_SIZE_CLASS[fontSize],
        fontFamily === "serif"
          ? "[font-family:var(--font-reading-serif)]"
          : "font-sans",
      )}
    >
      <div className="space-y-6">
        {paragraphs.map((p) => (
          <div
            key={p.idx}
            data-slot="paragraph"
            data-paragraph-idx={p.idx}
            id={paragraphDomId(articleId, p.idx)}
            className={cn(
              "group/paragraph motion-safe:animate-reading-paragraph",
              feedback[p.idx] === "stuck" && "rounded-xl bg-amber-200/15 px-2 py-1",
              feedback[p.idx] === "ok" && "opacity-95",
            )}
            style={{ animationDelay: `${Math.min(p.idx, 6) * 45}ms` }}
          >
            <p className="m-0">
              {p.sentences.map((s) => (
                <Fragment key={s.globalIdx}>
                  <span
                    data-slot="sentence"
                    id={sentenceDomId(articleId, s.globalIdx)}
                    data-speaking={
                      currentSentenceIdx === s.globalIdx ? "true" : "false"
                    }
                  >
                    {s.segments.map((seg, i) =>
                      seg.kind === "target" && seg.word ? (
                        <TargetMark
                          key={i}
                          articleId={articleId}
                          articleWord={seg.word}
                          word={wordIndex.get(seg.word.word_id) ?? null}
                          challengeMode={challengeMode}
                          onMaster={onMaster}
                          onRecognize={onRecognize}
                          onSpeak={onSpeak}
                        >
                          {seg.text}
                        </TargetMark>
                      ) : (
                        <Fragment key={i}>{seg.text}</Fragment>
                      ),
                    )}
                  </span>{" "}
                </Fragment>
              ))}
            </p>
            {paragraphFeedbackEnabled && (
              <ParagraphFeedbackButtons
                value={feedback[p.idx] ?? null}
                onChange={(next) => onFeedbackChange(p.idx, next)}
              />
            )}
          </div>
        ))}
        <div ref={endSentinelRef} aria-hidden />
      </div>
    </article>
  )
}
