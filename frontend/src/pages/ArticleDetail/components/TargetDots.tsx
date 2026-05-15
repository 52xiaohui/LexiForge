import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"
import type { ArticleWord, VocabWord } from "@/types/api"

import { targetDomId } from "../parsing"

export interface TargetDotsProps {
  articleId: string
  /** Located targets in reading order. */
  targets: ArticleWord[]
  /** Optional vocab index so we can colour the dot by mastery. */
  wordIndex: Map<string, VocabWord>
  /** Index of the target the toolbar is currently jumping to. */
  activeIdx: number
  onJump: (idx: number) => void
}

/**
 * A dotted progress column pinned to the left of the reading body. Each dot
 * represents one target word — passing one fills the dot, the active one
 * grows, mastered ones turn emerald, and a click jumps to that mark.
 *
 * Auto-hides on small screens; the mobile toolbar offers prev/next instead.
 */
export function TargetDots({
  articleId,
  targets,
  wordIndex,
  activeIdx,
  onJump,
}: TargetDotsProps) {
  const [passed, setPassed] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (targets.length === 0) return undefined
    const elements: HTMLElement[] = []
    const lookup = new Map<string, string>()
    for (const t of targets) {
      const id = targetDomId(articleId, t.word_id)
      const el = document.getElementById(id)
      if (el) {
        elements.push(el)
        lookup.set(id, t.word_id)
      }
    }
    if (elements.length === 0) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        setPassed((prev) => {
          let next = prev
          for (const e of entries) {
            // A dot fires once its mark scrolls past the top half — gives the
            // reader the satisfaction of "yep, I got that one" rather than
            // waiting until it's off-screen.
            if (
              e.isIntersecting ||
              e.boundingClientRect.top < (e.rootBounds?.height ?? 0) / 2
            ) {
              const wordId = lookup.get(e.target.id)
              if (wordId && !next.has(wordId)) {
                if (next === prev) next = new Set(prev)
                next.add(wordId)
              }
            }
          }
          return next
        })
      },
      { root: null, threshold: 0, rootMargin: "0px 0px -50% 0px" },
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [articleId, targets])

  if (targets.length === 0) return null

  return (
    <nav
      aria-label="目标词进度"
      className="hidden lg:fixed lg:top-32 lg:bottom-12 lg:left-3 lg:flex lg:flex-col lg:items-center lg:justify-center lg:gap-1.5"
    >
      <div className="flex flex-col items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-1.5 py-3 shadow-sm backdrop-blur">
        {targets.map((t, i) => {
          const word = wordIndex.get(t.word_id)
          const seen = passed.has(t.word_id)
          const active = activeIdx === i
          const mastered = Boolean(word?.mastered)
          return (
            <button
              key={t.word_id}
              type="button"
              onClick={() => onJump(i)}
              aria-label={`跳到目标词 ${t.spelling}`}
              className={cn(
                "block size-1.5 rounded-full transition-all hover:scale-150",
                active && "size-2.5",
                mastered
                  ? "bg-emerald-500/80"
                  : seen
                    ? "bg-amber-500/80"
                    : "bg-muted-foreground/30",
              )}
              title={t.spelling}
            />
          )
        })}
      </div>
    </nav>
  )
}
