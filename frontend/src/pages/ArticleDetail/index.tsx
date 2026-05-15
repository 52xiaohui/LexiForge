import {
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useReadingPrefs } from "@/hooks/use-reading-prefs"
import {
  formatArticleLength,
  formatCoverage,
  formatDifficulty,
  formatRelativeTime,
} from "@/lib/formatters"
import { mockStore } from "@/lib/mock-data"
import type { ParagraphFeedback as ParagraphFeedbackValue } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import type {
  ArticleDetail as ArticleDetailType,
  CefrLevel,
  VocabWord,
} from "@/types/api"

import { ArticleBody } from "./components/ArticleBody"
import { CoverageDrawer } from "./components/CoverageDrawer"
import { FinishBar } from "./components/FinishBar"
import {
  MobileReadingBar,
  ReadingToolbar,
} from "./components/ReadingToolbar"
import { ReadingProgress } from "./components/ReadingProgress"
import { ReviewSheet } from "./components/ReviewSheet"
import { TargetDots } from "./components/TargetDots"
import {
  locatedTargets,
  paragraphDomId,
  parseArticle,
  targetDomId,
} from "./parsing"
import { useKaraoke } from "./use-karaoke"

export function ArticleDetail() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: article, isFetching } = useQuery({
    queryKey: ["articles", id],
    queryFn: async () => mockStore.getArticle(id),
    enabled: Boolean(id),
  })

  // Load the full vocab index so the popover can enrich each target word with
  // synonyms / example_sentence / related articles that `article_words` lacks.
  const { data: words = [] } = useQuery({
    queryKey: ["vocab", "words"],
    queryFn: async () => mockStore.listWords(),
  })
  const wordIndex = useMemo(() => {
    const map = new Map<string, VocabWord>()
    for (const w of words) map.set(w.id, w)
    return map
  }, [words])

  const prefs = useReadingPrefs()

  // ---------- parsed body & target list (stable across re-renders) ----------
  const parsed = useMemo(() => {
    if (!article) return { paragraphs: [], sentences: [] }
    return parseArticle(article.content_markdown, article.article_words)
  }, [article])

  const targets = useMemo(
    () => (article ? locatedTargets(article.article_words) : []),
    [article],
  )

  // ---------- TTS ----------
  const karaoke = useKaraoke({
    sentences: parsed.sentences,
    lang: "en-US",
    rate: 0.95,
  })

  // ---------- mutations ----------
  const markRead = useMutation({
    mutationFn: async (articleId: string) => mockStore.markArticleRead(articleId),
    meta: { silent: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] })
    },
  })

  const markMastered = useMutation({
    mutationFn: async (word: { id: string; spelling: string }) => {
      mockStore.markWordMastered(word.id, true)
      return word
    },
    meta: { silent: true },
    onSuccess: (word) => {
      queryClient.invalidateQueries({ queryKey: ["vocab"] })
      toast("已标记为掌握", {
        description: word.spelling ? `「${word.spelling}」从薄弱词移除` : undefined,
        duration: 6000,
        action: {
          label: "撤销",
          onClick: () => {
            mockStore.markWordMastered(word.id, false)
            queryClient.invalidateQueries({ queryKey: ["vocab"] })
          },
        },
      })
    },
  })

  const markRecognized = useMutation({
    mutationFn: async ({
      id,
      recognized,
    }: {
      id: string
      recognized: boolean
    }) => {
      mockStore.markWordRecognized(id, recognized)
      return { id, recognized }
    },
    meta: { silent: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vocab"] })
    },
  })

  const regenerate = useMutation({
    mutationFn: async (source: ArticleDetailType) => {
      await new Promise((r) => setTimeout(r, 700))
      return mockStore.generateArticle({
        topic: source.topic,
        difficulty:
          source.difficulty === "B1-B2"
            ? ("B2" as CefrLevel)
            : (source.difficulty as CefrLevel),
        target_word_count: source.target_word_count,
        article_length: source.article_length,
      })
    },
    meta: { silent: true },
    onSuccess: ({ article_id }) => {
      queryClient.invalidateQueries({ queryKey: ["articles"] })
      toast.success("已用相同参数生成新文章", {
        description: "旧文章仍保留在历史里，正在跳转到新文章。",
      })
      navigate(`/articles/${article_id}`)
    },
    onError: (error) => {
      toast.error("重新生成失败", {
        description:
          error instanceof Error ? error.message : "请稍后再试。",
      })
    },
  })

  // ---------- mark-as-read ----------
  // Sentinel + 60s dwell, same idea as the legacy implementation but lifted
  // out of the body into a parent-owned ref so the new ArticleBody component
  // stays purely presentational.
  const markedRef = useRef<string | null>(null)
  const endSentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!article || article.read) return
    if (markedRef.current === article.id) return
    const articleId = article.id
    const sentinel = endSentinelRef.current
    if (!sentinel) return

    const mark = () => {
      if (markedRef.current === articleId) return
      markedRef.current = articleId
      markRead.mutate(articleId)
    }

    const timer = window.setTimeout(mark, 60_000)
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) mark()
      },
      { root: null, threshold: 0, rootMargin: "0px 0px -10% 0px" },
    )
    io.observe(sentinel)

    return () => {
      window.clearTimeout(timer)
      io.disconnect()
    }
    // `markRead` mutation is stable across renders thanks to react-query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article])

  // ---------- target navigation ----------
  // Reset the cursor whenever the route id changes. We use the
  // "reset state on prop change" pattern (compare against a stored snapshot
  // during render) rather than a useEffect so we don't trigger an extra
  // render after a route change.
  const [targetIdx, setTargetIdx] = useState(0)
  const [trackedId, setTrackedId] = useState(id)
  if (id !== trackedId) {
    setTrackedId(id)
    setTargetIdx(0)
  }

  const scrollToTarget = (wordId: string) => {
    if (!article) return
    const el = document.getElementById(targetDomId(article.id, wordId))
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    el.classList.add("ring-2", "ring-offset-2", "ring-amber-400")
    window.setTimeout(
      () => el.classList.remove("ring-2", "ring-offset-2", "ring-amber-400"),
      1400,
    )
  }

  const jumpToTarget = (delta: number) => {
    if (targets.length === 0 || !article) return
    const next = (targetIdx + delta + targets.length) % targets.length
    setTargetIdx(next)
    const target = targets[next]
    if (target) scrollToTarget(target.word_id)
  }

  // ---------- per-paragraph feedback ----------
  // Mirror the in-memory store into local state so we can re-render on
  // change without forcing a TanStack invalidation. Reset on article change
  // via the same render-time pattern so we don't pay an extra effect tick.
  const [feedback, setFeedback] = useState<Record<number, ParagraphFeedbackValue>>(
    () => (article ? mockStore.getParagraphFeedback(article.id) : {}),
  )
  const [feedbackArticleId, setFeedbackArticleId] = useState(article?.id ?? null)
  if (article && article.id !== feedbackArticleId) {
    setFeedbackArticleId(article.id)
    setFeedback(mockStore.getParagraphFeedback(article.id))
  }
  const handleFeedbackChange = (
    paragraphIdx: number,
    value: ParagraphFeedbackValue | null,
  ) => {
    if (!article) return
    mockStore.setParagraphFeedback(article.id, paragraphIdx, value)
    setFeedback(mockStore.getParagraphFeedback(article.id))
  }

  // ---------- last-read paragraph anchor + auto-resume ----------
  const handleParagraphReached = (paragraphIdx: number) => {
    if (!article) return
    mockStore.setLastParagraph(article.id, paragraphIdx)
  }

  // Resume on first article load: if the bookmark is past the first paragraph
  // and the body is rendered, scroll to it. We intentionally skip during the
  // mark-read mutation invalidation re-render to avoid jumping after the user
  // already scrolled around.
  const resumedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!article) return
    if (resumedRef.current === article.id) return
    const last = mockStore.getLastParagraph(article.id)
    if (last == null || last <= 0) {
      resumedRef.current = article.id
      return
    }
    // Wait one frame so the body is in the DOM.
    const handle = window.requestAnimationFrame(() => {
      const el = document.getElementById(paragraphDomId(article.id, last))
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" })
        toast("续读到这里", {
          description: `从上次读到的第 ${last + 1} 段开始。`,
          duration: 4000,
        })
      }
      resumedRef.current = article.id
    })
    return () => window.cancelAnimationFrame(handle)
  }, [article?.id, article])

  // ---------- keyboard ----------
  useEffect(() => {
    if (!article) return
    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === "n" || (e.shiftKey && e.key === "ArrowRight")) {
        e.preventDefault()
        jumpToTarget(1)
      } else if (key === "p" || (e.shiftKey && e.key === "ArrowLeft")) {
        e.preventDefault()
        jumpToTarget(-1)
      } else if (!e.shiftKey && key === "f") {
        e.preventDefault()
        prefs.toggleFocusMode()
      } else if (!e.shiftKey && key === "c") {
        e.preventDefault()
        prefs.toggleChallengeMode()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article, targetIdx, targets])

  // ---------- drawers ----------
  const [wordListOpen, setWordListOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  if (!article && !isFetching) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="max-w-md text-center">
          <div className="font-heading text-2xl font-semibold tracking-tight">
            找不到这篇文章
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            它可能已经被删除，或者这个链接不对。
          </p>
          <Button asChild variant="outline" size="sm" className="mt-6">
            <Link to="/articles">
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                data-icon="inline-start"
                strokeWidth={1.8}
              />
              回到历史列表
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!article) {
    return (
      <div className="py-24 text-center text-sm text-muted-foreground">
        加载中…
      </div>
    )
  }

  const covered = article.article_words.filter((w) => w.is_covered)

  const masterAll = () => {
    const toMaster = covered.filter(
      (w) => !wordIndex.get(w.word_id)?.mastered,
    )
    if (toMaster.length === 0) {
      toast("这些词都已经掌握了", {
        description: "没有需要更新的状态。",
      })
      return
    }
    for (const w of toMaster) {
      mockStore.markWordMastered(w.word_id, true)
    }
    queryClient.invalidateQueries({ queryKey: ["vocab"] })
    toast("已批量标记已掌握", {
      description: `共 ${toMaster.length} 个词从薄弱词中移除`,
      duration: 8000,
      action: {
        label: "撤销",
        onClick: () => {
          for (const w of toMaster) {
            mockStore.markWordMastered(w.word_id, false)
          }
          queryClient.invalidateQueries({ queryKey: ["vocab"] })
        },
      },
    })
  }

  const handleExport = () => {
    const md = buildMarkdown(article)
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${article.title.replace(/[\\/:*?"<>|]+/g, "_")}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("导出成功", { description: `${a.download}` })
  }

  // ---------- toolbar handlers ----------
  const onPlay = () => karaoke.play(0)
  const onSpeechPrev = () => karaoke.prev()
  const onSpeechNext = () => karaoke.next()

  return (
    <div className="space-y-4 pb-20 sm:pb-4">
      <ReadingProgress />

      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/articles">
            <HugeiconsIcon
              icon={ArrowLeft01Icon}
              data-icon="inline-start"
              strokeWidth={1.8}
            />
            历史列表
          </Link>
        </Button>
      </div>

      <ReadingToolbar
        fontSize={prefs.fontSize}
        onFontSize={prefs.setFontSize}
        fontFamily={prefs.fontFamily}
        onFontFamily={prefs.setFontFamily}
        tone={prefs.tone}
        onTone={prefs.setTone}
        challengeMode={prefs.challengeMode}
        onChallengeMode={prefs.setChallengeMode}
        paragraphFeedback={prefs.paragraphFeedback}
        onParagraphFeedback={prefs.setParagraphFeedback}
        speechSupported={karaoke.supported}
        speechSpeaking={karaoke.speaking}
        speechPaused={karaoke.paused}
        onPlay={onPlay}
        onPause={karaoke.pause}
        onResume={karaoke.resume}
        onStop={karaoke.cancel}
        onSpeechPrev={onSpeechPrev}
        onSpeechNext={onSpeechNext}
        hasTargets={targets.length > 0}
        targetIndex={targetIdx}
        targetCount={targets.length}
        onPrevTarget={() => jumpToTarget(-1)}
        onNextTarget={() => jumpToTarget(1)}
        onOpenWordList={() => setWordListOpen(true)}
        onOpenReview={() => setReviewOpen(true)}
      />

      {/* The article column is always centered now. The legacy `lg:col-span-3 +
          lg:col-span-2` grid was retired in favour of a floating drawer for
          coverage info, so the body can keep ~70ch on every screen. */}
      <div
        className={cn(
          "mx-auto w-full",
          // ~70ch reading width — leans on Tailwind's max-w-prose token but
          // matches the body's serif tone via a slightly tighter constraint.
          "max-w-[70ch]",
        )}
      >
        <header className="space-y-3 py-2">
          <h1 className="font-heading text-3xl leading-tight font-semibold tracking-tight">
            {article.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">
              {formatDifficulty(article.difficulty)}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {formatArticleLength(article.article_length)}
            </Badge>
            <span>{article.topic}</span>
            <span aria-hidden>·</span>
            <span>{formatRelativeTime(article.created_at)}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={12}
                strokeWidth={1.8}
              />
              覆盖 {formatCoverage(article.coverage_rate)}
            </span>
          </div>
        </header>

        <ArticleBody
          articleId={article.id}
          paragraphs={parsed.paragraphs}
          wordIndex={wordIndex}
          fontSize={prefs.fontSize}
          fontFamily={prefs.fontFamily}
          tone={prefs.tone}
          challengeMode={prefs.challengeMode}
          paragraphFeedbackEnabled={prefs.paragraphFeedback}
          currentSentenceIdx={karaoke.currentSentenceIdx}
          feedback={feedback}
          onFeedbackChange={handleFeedbackChange}
          onMaster={(wordId, spelling) => markMastered.mutate({ id: wordId, spelling })}
          onRecognize={(wordId, recognized) =>
            markRecognized.mutate({ id: wordId, recognized })
          }
          onSpeak={karaoke.speakOne}
          onParagraphReached={handleParagraphReached}
          endSentinelRef={endSentinelRef}
        />

        <div className="mt-6">
          <FinishBar
            coveredCount={covered.length}
            onMasterAll={masterAll}
            onRegenerate={() => regenerate.mutate(article)}
            isRegenerating={regenerate.isPending}
            onExport={handleExport}
            onPracticeWords={() => setReviewOpen(true)}
          />
        </div>
      </div>

      <TargetDots
        articleId={article.id}
        targets={targets}
        wordIndex={wordIndex}
        activeIdx={targetIdx}
        onJump={(idx) => {
          setTargetIdx(idx)
          const t = targets[idx]
          if (t) scrollToTarget(t.word_id)
        }}
      />

      <CoverageDrawer
        open={wordListOpen}
        onOpenChange={setWordListOpen}
        article={article}
        wordIndex={wordIndex}
        onScrollTo={scrollToTarget}
        onMaster={(wordId, spelling) =>
          markMastered.mutate({ id: wordId, spelling })
        }
        onRecognize={(wordId, recognized) =>
          markRecognized.mutate({ id: wordId, recognized })
        }
        onSpeak={karaoke.speakOne}
      />

      <ReviewSheet
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        article={article}
        sentences={parsed.sentences}
        wordIndex={wordIndex}
        onMaster={(wordId, spelling) =>
          markMastered.mutate({ id: wordId, spelling })
        }
        onRecognize={(wordId, recognized) =>
          markRecognized.mutate({ id: wordId, recognized })
        }
        onSpeak={karaoke.speakOne}
      />

      <MobileReadingBar
        fontSize={prefs.fontSize}
        onFontSize={prefs.setFontSize}
        fontFamily={prefs.fontFamily}
        onFontFamily={prefs.setFontFamily}
        tone={prefs.tone}
        onTone={prefs.setTone}
        challengeMode={prefs.challengeMode}
        onChallengeMode={prefs.setChallengeMode}
        paragraphFeedback={prefs.paragraphFeedback}
        onParagraphFeedback={prefs.setParagraphFeedback}
        speechSupported={karaoke.supported}
        speechSpeaking={karaoke.speaking}
        speechPaused={karaoke.paused}
        onPlay={onPlay}
        onPause={karaoke.pause}
        onResume={karaoke.resume}
        onStop={karaoke.cancel}
        hasTargets={targets.length > 0}
        onPrevTarget={() => jumpToTarget(-1)}
        onNextTarget={() => jumpToTarget(1)}
        onOpenWordList={() => setWordListOpen(true)}
        onOpenReview={() => setReviewOpen(true)}
      />
    </div>
  )
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']"),
  )
}

function buildMarkdown(article: ArticleDetailType): string {
  const targets = article.article_words
    .map((w) => {
      const state = w.is_covered ? "✓" : "✗"
      const translation = w.translation ? ` — ${w.translation}` : ""
      return `- ${state} **${w.spelling}**${translation}`
    })
    .join("\n")

  return `# ${article.title}

> ${article.topic} · ${article.difficulty} · ${formatArticleLength(article.article_length)} · 覆盖 ${formatCoverage(article.coverage_rate)} (${article.covered_word_count}/${article.target_word_count})

${article.content_markdown}

---

## 目标词

${targets}
`
}
