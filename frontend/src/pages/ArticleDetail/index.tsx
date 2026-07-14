import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { ErrorState } from "@/components/common/StatusPanel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useReadingPrefs } from "@/hooks/use-reading-prefs"
import {
  buildGeneratePath,
  RECOMMEND_COUNT,
} from "@/lib/article-generation"
import { toastError } from "@/lib/errors"
import {
  formatArticleLength,
  formatCoverage,
  formatDifficulty,
  formatRelativeTime,
} from "@/lib/formatters"
import { api, wordIndexFromArticleWords } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { withSim } from "@/lib/query-sim"
import type { ArticleDetail as ArticleDetailType } from "@/types/api"

import { ArticleBody } from "./components/ArticleBody"
import { CoverageDrawer } from "./components/CoverageDrawer"
import { FinishBar } from "./components/FinishBar"
import type { ParagraphFeedbackValue } from "./components/ParagraphFeedback"
import { MobileReadingBar, ReadingToolbar } from "./components/ReadingToolbar"
import { ReadingProgress } from "./components/ReadingProgress"
import { ReviewSheet } from "./components/ReviewSheet"
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

  const {
    data: article,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.articles.detail(id),
    queryFn: withSim(() => api.getArticle(id), { emptyValue: null }),
    enabled: Boolean(id),
  })

  // Learning signals for target popovers come embedded on article_words —
  // no full-vocabulary listWords() round-trip.
  const wordIndex = useMemo(
    () => wordIndexFromArticleWords(article?.article_words ?? []),
    [article?.article_words]
  )

  const prefs = useReadingPrefs()

  // ---------- parsed body & target list (stable across re-renders) ----------
  const parsed = useMemo(() => {
    if (!article) return { paragraphs: [], sentences: [] }
    return parseArticle(article.content_markdown, article.article_words)
  }, [article])

  const targets = useMemo(
    () => (article ? locatedTargets(article.article_words) : []),
    [article]
  )

  // ---------- TTS ----------
  const karaoke = useKaraoke({
    sentences: parsed.sentences,
    lang: "en-US",
    rate: 0.95,
  })

  // ---------- mutations ----------
  const markRead = useMutation({
    mutationFn: async (articleId: string) => api.markArticleRead(articleId),
    meta: { silent: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all })
    },
  })

  const updateProgress = useMutation({
    mutationFn: async ({
      articleId,
      paragraphIdx,
      progressPercent,
    }: {
      articleId: string
      paragraphIdx: number
      progressPercent: number
    }) =>
      api.updateArticleProgress(articleId, {
        status: "reading",
        progress_percent: progressPercent,
        last_paragraph_index: paragraphIdx,
      }),
    meta: { silent: true },
  })

  const markMastered = useMutation({
    mutationFn: async (word: { id: string; spelling: string }) => {
      await api.markWordMastered(word.id, true, article?.id)
      return word
    },
    meta: { silent: true },
    onSuccess: (word) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vocab.all })
      if (id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.articles.detail(id),
        })
      }
      toast("已标记为掌握", {
        description: word.spelling
          ? `「${word.spelling}」从薄弱词移除`
          : undefined,
        duration: 6000,
      })
    },
    onError: (error) => {
      toastError("标记掌握失败", error)
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
      await api.markWordRecognized(id, recognized, article?.id)
      return { id, recognized }
    },
    meta: { silent: true },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.vocab.all })
      if (id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.articles.detail(id),
        })
      }
    },
    onError: (error) => {
      toastError("记录失败", error)
    },
  })

  const regenerate = useMutation({
    mutationFn: async (source: ArticleDetailType) =>
      api.regenerateArticle(source.id),
    meta: { silent: true },
    onSuccess: ({ article_id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all })
      toast.success("已用相同参数生成新文章", {
        description: "旧文章仍保留在历史里，正在跳转到新文章。",
      })
      navigate(`/articles/${article_id}`)
    },
    onError: (error) => {
      toastError("重新生成失败", error)
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
      { root: null, threshold: 0, rootMargin: "0px 0px -10% 0px" }
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
      1400
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
  // This is an in-page reading aid only. Durable learning signals are recorded
  // through word-events, while durable location lives in article progress.
  const [feedback, setFeedback] = useState<
    Record<number, ParagraphFeedbackValue>
  >({})
  const [feedbackArticleId, setFeedbackArticleId] = useState(
    article?.id ?? null
  )
  if (article && article.id !== feedbackArticleId) {
    setFeedbackArticleId(article.id)
    setFeedback({})
  }
  const handleFeedbackChange = (
    paragraphIdx: number,
    value: ParagraphFeedbackValue | null
  ) => {
    if (!article) return
    setFeedback((prev) => {
      const next = { ...prev }
      if (value) next[paragraphIdx] = value
      else delete next[paragraphIdx]
      return next
    })
  }

  // ---------- last-read paragraph anchor + auto-resume ----------
  const trackedProgressRef = useRef<{
    articleId: string
    paragraphIdx: number
  } | null>(null)
  const handleParagraphReached = (paragraphIdx: number) => {
    if (!article) return
    if (article.read) return
    const previous = trackedProgressRef.current
    if (
      previous?.articleId === article.id &&
      paragraphIdx <= previous.paragraphIdx
    ) {
      return
    }
    const paragraphCount = parsed.paragraphs.length
    if (paragraphCount === 0) return
    const progressPercent = Math.min(
      99,
      Math.max(1, Math.round(((paragraphIdx + 1) / paragraphCount) * 100))
    )
    trackedProgressRef.current = { articleId: article.id, paragraphIdx }
    updateProgress.mutate({
      articleId: article.id,
      paragraphIdx,
      progressPercent,
    })
  }

  // Resume on first article load: if the bookmark is past the first paragraph
  // and the body is rendered, scroll to it. We intentionally skip during the
  // mark-read mutation invalidation re-render to avoid jumping after the user
  // already scrolled around.
  const resumedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!article) return
    const last = article.progress?.last_paragraph_index
    trackedProgressRef.current = {
      articleId: article.id,
      paragraphIdx: last ?? -1,
    }
    if (resumedRef.current === article.id) return
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

  if (isError) {
    return (
      <ErrorState
        description="没能加载这篇文章。请稍后重试。"
        onRetry={() => refetch()}
      />
    )
  }

  if (!article && isFetching) {
    return <ReadingSkeleton />
  }

  if (!article) {
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

  const covered = article.article_words.filter((w) => w.is_covered)
  const nextGenerateTo = buildGeneratePath({
    autoRecommend: RECOMMEND_COUNT,
    topic: article.topic,
    difficulty: article.difficulty,
    length: article.article_length,
  })

  const masterAll = async () => {
    const toMaster = covered.filter((w) => !wordIndex.get(w.word_id)?.mastered)
    if (toMaster.length === 0) {
      toast("这些词都已经掌握了", {
        description: "没有需要更新的状态。",
      })
      return
    }
    try {
      await Promise.all(
        toMaster.map((w) => api.markWordMastered(w.word_id, true, article.id))
      )
    } catch (error) {
      toastError("批量标记失败", error)
      return
    }
    queryClient.invalidateQueries({ queryKey: queryKeys.vocab.all })
    if (id) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.articles.detail(id),
      })
    }
    toast("已批量标记已掌握", {
      description: `共 ${toMaster.length} 个词从薄弱词中移除`,
      duration: 8000,
    })
  }

  const handleExport = async () => {
    try {
      const md = await api.exportArticleMarkdown(article.id)
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
    } catch (error) {
      toastError("导出失败", error)
    }
  }

  // ---------- toolbar handlers ----------
  const onPlay = () => karaoke.play(0)
  const onSpeechPrev = () => karaoke.prev()
  const onSpeechNext = () => karaoke.next()

  return (
    <div
      data-slot="article-detail-page"
      className="relative -mx-4 -my-6 px-4 py-6 pb-20 sm:-mx-6 sm:-my-8 sm:px-6 sm:py-8 sm:pb-10 lg:-mx-10 lg:-my-12 lg:px-10 lg:py-12"
    >
      <ReadingProgress />

      <div className="mt-2 mb-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
        >
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
      <div className="mx-auto mt-5 w-full max-w-[74ch]">
        <header
          data-slot="article-hero"
          className="mx-auto max-w-[68ch] space-y-4 py-6 text-center sm:py-8"
        >
          <h1 className="[font-family:var(--font-reading-serif)] text-4xl leading-[1.08] font-medium tracking-normal text-balance sm:text-5xl sm:leading-[1.03]">
            {article.title}
          </h1>
          <div className="mx-auto flex max-w-[64ch] flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">
              {formatDifficulty(article.difficulty)}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {formatArticleLength(article.article_length)}
            </Badge>
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
            <span>{article.topic}</span>
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
            <span>{formatRelativeTime(article.created_at)}</span>
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
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

        {article.generation_status === "low_coverage" && (
          <div className="mb-5 flex items-start gap-3 border-y border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            <HugeiconsIcon
              icon={AlertCircleIcon}
              size={18}
              strokeWidth={1.8}
              className="mt-0.5 shrink-0"
            />
            <p>
              这篇文章的目标词覆盖率低于
              90%。未覆盖词仍保留在词表中，可以重新生成后再练习。
            </p>
          </div>
        )}

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
          onMaster={(wordId, spelling) =>
            markMastered.mutate({ id: wordId, spelling })
          }
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
            nextGenerateTo={nextGenerateTo}
          />
        </div>
      </div>

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
    target.closest("input, textarea, select, [contenteditable='true']")
  )
}

function ReadingSkeleton() {
  return (
    <div className="pb-20 sm:pb-4">
      <div className="mt-2 mb-2">
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="mx-auto mt-4 w-full max-w-[70ch] space-y-6">
        <div className="space-y-3 py-2">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  )
}
