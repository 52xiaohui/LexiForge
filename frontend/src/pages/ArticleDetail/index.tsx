import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  BookmarkAdd02Icon,
  CheckmarkCircle02Icon,
  Download04Icon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
  RefreshIcon,
  SparklesIcon,
  TextFontIcon,
  ViewOffSlashIcon,
  VolumeHighIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"

import { LastResponseBadge } from "@/components/common/LastResponseBadge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  FONT_SIZE_LABELS,
  FONT_SIZE_ORDER,
  useReadingPrefs,
  type ReadingFontSize,
} from "@/hooks/use-reading-prefs"
import { useSpeech } from "@/hooks/use-speech"
import {
  formatArticleLength,
  formatCoverage,
  formatDifficulty,
  formatRelativeTime,
} from "@/lib/formatters"
import { mockStore } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import type {
  ArticleDetail as ArticleDetailType,
  ArticleWord,
  CefrLevel,
  VocabWord,
} from "@/types/api"

// Per-mode body type. Values tuned for comfortable paragraph reading at each
// preset — leading grows slightly with size so long articles stay legible.
const FONT_SIZE_CLASS: Record<ReadingFontSize, string> = {
  sm: "text-[14px] leading-[1.85]",
  md: "text-[15px] leading-[1.9]",
  lg: "text-[17px] leading-[1.95]",
  xl: "text-[19px] leading-[2]",
}

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

  const { fontSize, setFontSize, focusMode, toggleFocusMode } = useReadingPrefs()
  const speech = useSpeech({ lang: "en-US", rate: 0.9 })

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

  // Mark-as-read strategy:
  // - A sentinel at the end of the article body fires via IntersectionObserver
  //   when the reader actually scrolls past ~80% of the content.
  // - A 60s dwell timer fires as a fallback for very short articles where the
  //   bottom might already be in view on mount.
  // The ref gates the one-shot so mark-read triggers at most once per article.
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

  // Cancel any in-flight TTS when leaving the page.
  useEffect(() => {
    return () => speech.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const segments = useMemo(() => {
    if (!article) return []
    return buildSegments(article.content_markdown, article.article_words)
  }, [article])

  // Ordered list of located targets — drives prev / next jumping.
  const locatedTargets = useMemo<ArticleWord[]>(() => {
    if (!article) return []
    return article.article_words
      .filter((w) => w.is_covered && w.char_offset >= 0)
      .slice()
      .sort((a, b) => a.char_offset - b.char_offset)
  }, [article])

  const [targetIdx, setTargetIdx] = useState(0)
  useEffect(() => {
    setTargetIdx(0)
  }, [id])

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
    if (locatedTargets.length === 0 || !article) return
    const next = (targetIdx + delta + locatedTargets.length) % locatedTargets.length
    setTargetIdx(next)
    const target = locatedTargets[next]
    if (target) scrollToTarget(target.word_id)
  }

  // Global keyboard shortcuts — avoid handling when focus is in form inputs.
  // Only react to the explicit letter keys (N/P/F) and Shift+Arrow combos so
  // plain ArrowLeft / ArrowRight continue to scroll the page natively.
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
        toggleFocusMode()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article, targetIdx, locatedTargets])

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
  const uncovered = article.article_words.filter((w) => !w.is_covered)

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

  const playArticle = () => {
    if (speech.speaking) {
      speech.cancel()
      return
    }
    speech.speak(article.content_markdown)
  }

  return (
    <div className="space-y-4">
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
        fontSize={fontSize}
        onFontSize={setFontSize}
        focusMode={focusMode}
        onFocusMode={toggleFocusMode}
        speechSupported={speech.supported}
        speechPlaying={speech.speaking}
        onTogglePlay={playArticle}
        hasTargets={locatedTargets.length > 0}
        targetIndex={targetIdx}
        targetCount={locatedTargets.length}
        onPrevTarget={() => jumpToTarget(-1)}
        onNextTarget={() => jumpToTarget(1)}
      />

      <div
        className={cn(
          "grid gap-6",
          focusMode ? "grid-cols-1" : "lg:grid-cols-5",
        )}
      >
        <div
          className={cn(
            "space-y-4",
            focusMode
              ? "mx-auto w-full max-w-3xl"
              : "lg:col-span-3",
          )}
        >
          <header className="space-y-3">
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
            </div>
          </header>

          <article
            className={cn(
              "rounded-3xl bg-card p-6 text-card-foreground ring-1 ring-foreground/5 sm:p-8",
              FONT_SIZE_CLASS[fontSize],
            )}
          >
            <div className="space-y-4">
              {renderParagraphs(
                segments,
                article.id,
                wordIndex,
                (wordId, spelling) => markMastered.mutate({ id: wordId, spelling }),
                speech.speak,
              )}
              <div ref={endSentinelRef} aria-hidden />
            </div>
          </article>

          <FinishBar
            coveredCount={covered.length}
            onMasterAll={masterAll}
            onRegenerate={() => regenerate.mutate(article)}
            isRegenerating={regenerate.isPending}
            onExport={handleExport}
          />
        </div>

        {!focusMode && (
          <aside className="space-y-4 lg:col-span-2">
            <CoverageCard article={article} />
            <CoverageList
              covered={covered}
              uncovered={uncovered}
              wordIndex={wordIndex}
              onScrollTo={scrollToTarget}
              onMaster={(wordId, spelling) =>
                markMastered.mutate({ id: wordId, spelling })
              }
              onSpeak={speech.speak}
            />
            <Card size="sm">
              <CardHeader className="border-b">
                <CardTitle>文章参数</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <InfoRow label="主题" value={article.topic} />
                <InfoRow label="难度" value={formatDifficulty(article.difficulty)} />
                <InfoRow label="长度" value={formatArticleLength(article.article_length)} />
                <InfoRow label="目标词数" value={String(article.target_word_count)} />
              </CardContent>
            </Card>
          </aside>
        )}
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------------
// Reading surface — sticky progress bar + toolbar
// --------------------------------------------------------------------------------

function ReadingProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const update = () => {
      const doc = document.documentElement
      const scrolled = doc.scrollTop
      const max = doc.scrollHeight - doc.clientHeight
      const pct = max > 0 ? Math.min(100, (scrolled / max) * 100) : 0
      setProgress(pct)
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [])
  return (
    <div
      role="progressbar"
      aria-label="阅读进度"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="sticky top-16 z-20 h-[2px] overflow-hidden rounded-full bg-border/40"
    >
      <div
        className="h-full bg-foreground transition-[width] duration-150"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

interface ReadingToolbarProps {
  fontSize: ReadingFontSize
  onFontSize: (size: ReadingFontSize) => void
  focusMode: boolean
  onFocusMode: () => void
  speechSupported: boolean
  speechPlaying: boolean
  onTogglePlay: () => void
  hasTargets: boolean
  targetIndex: number
  targetCount: number
  onPrevTarget: () => void
  onNextTarget: () => void
}

function ReadingToolbar({
  fontSize,
  onFontSize,
  focusMode,
  onFocusMode,
  speechSupported,
  speechPlaying,
  onTogglePlay,
  hasTargets,
  targetIndex,
  targetCount,
  onPrevTarget,
  onNextTarget,
}: ReadingToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-muted/30 p-2">
      {speechSupported && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={speechPlaying ? "secondary" : "ghost"}
              size="sm"
              aria-label={speechPlaying ? "暂停朗读" : "朗读全文"}
              onClick={onTogglePlay}
            >
              <HugeiconsIcon
                icon={speechPlaying ? PauseIcon : PlayIcon}
                data-icon="inline-start"
                strokeWidth={1.8}
              />
              {speechPlaying ? "暂停" : "朗读"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>使用浏览器 Web Speech · en-US</TooltipContent>
        </Tooltip>
      )}

      <FontSizePopover fontSize={fontSize} onFontSize={onFontSize} />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={focusMode ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={focusMode}
            aria-label="专注模式"
            onClick={onFocusMode}
          >
            <HugeiconsIcon
              icon={ViewOffSlashIcon}
              data-icon="inline-start"
              strokeWidth={1.8}
            />
            专注模式
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          隐藏侧栏，文章居中
          <span className="opacity-60"> (按 F)</span>
        </TooltipContent>
      </Tooltip>

      {hasTargets && (
        <div className="ms-auto flex items-center gap-1">
          <span className="text-xs tabular-nums text-muted-foreground">
            目标词 {targetIndex + 1} / {targetCount}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="上一个目标词"
                onClick={onPrevTarget}
              >
                <HugeiconsIcon icon={PreviousIcon} strokeWidth={1.8} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              上一个 <span className="opacity-60">(P / Shift + ←)</span>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="下一个目标词"
                onClick={onNextTarget}
              >
                <HugeiconsIcon icon={NextIcon} strokeWidth={1.8} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              下一个 <span className="opacity-60">(N / Shift + →)</span>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  )
}

function FontSizePopover({
  fontSize,
  onFontSize,
}: {
  fontSize: ReadingFontSize
  onFontSize: (size: ReadingFontSize) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="调整字号">
          <HugeiconsIcon
            icon={TextFontIcon}
            data-icon="inline-start"
            strokeWidth={1.8}
          />
          字号 {FONT_SIZE_LABELS[fontSize].split("·")[1]}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1">
        <div className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase px-2 py-1">
          阅读字号
        </div>
        {FONT_SIZE_ORDER.map((size) => (
          <button
            key={size}
            type="button"
            onClick={() => onFontSize(size)}
            aria-pressed={fontSize === size}
            className={cn(
              "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors",
              fontSize === size
                ? "bg-foreground text-background"
                : "hover:bg-muted",
            )}
          >
            <span>{FONT_SIZE_LABELS[size]}</span>
            {fontSize === size && (
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={14}
                strokeWidth={1.8}
              />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

// --------------------------------------------------------------------------------
// Subcomponents
// --------------------------------------------------------------------------------

function targetDomId(articleId: string, wordId: string): string {
  return `target-${articleId}-${wordId}`
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']"),
  )
}

interface CoverageCardProps {
  article: ArticleDetailType
}

function CoverageCard({ article }: CoverageCardProps) {
  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} strokeWidth={1.8} />
          覆盖率
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          <div className="font-heading text-3xl font-semibold tabular-nums">
            {formatCoverage(article.coverage_rate)}
          </div>
          <div className="pb-1 text-xs text-muted-foreground">
            {article.covered_word_count} / {article.target_word_count} 词命中
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-foreground"
            style={{
              width: `${Math.min(100, Math.round(article.coverage_rate * 100))}%`,
            }}
          />
        </div>
      </CardContent>
    </Card>
  )
}

interface CoverageListProps {
  covered: ArticleWord[]
  uncovered: ArticleWord[]
  wordIndex: Map<string, VocabWord>
  onScrollTo: (wordId: string) => void
  onMaster: (wordId: string, spelling: string) => void
  onSpeak: (text: string) => void
}

function CoverageList({
  covered,
  uncovered,
  wordIndex,
  onScrollTo,
  onMaster,
  onSpeak,
}: CoverageListProps) {
  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          本文词汇
          <span className="text-xs font-normal text-muted-foreground">
            {covered.length} 命中 · {uncovered.length} 漏掉
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {covered.length > 0 && (
          <ul className="space-y-1.5 text-sm">
            {covered.map((w) => (
              <li
                key={w.word_id}
                className="group flex items-center justify-between gap-3 rounded-lg px-1 py-1 hover:bg-muted/40"
              >
                <button
                  type="button"
                  onClick={() => onScrollTo(w.word_id)}
                  className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
                >
                  <span className="font-heading text-sm font-medium">
                    {w.spelling}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {w.translation}
                  </span>
                </button>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`朗读 ${w.spelling}`}
                    onClick={() => onSpeak(w.spelling)}
                  >
                    <HugeiconsIcon icon={VolumeHighIcon} strokeWidth={1.8} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`标记 ${w.spelling} 已掌握`}
                    disabled={wordIndex.get(w.word_id)?.mastered}
                    onClick={() => onMaster(w.word_id, w.spelling)}
                  >
                    <HugeiconsIcon
                      icon={CheckmarkCircle02Icon}
                      strokeWidth={1.8}
                    />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {uncovered.length > 0 && (
          <div className="space-y-2 border-t border-border/60 pt-3">
            <div className="flex items-center gap-2 text-xs text-destructive">
              <HugeiconsIcon
                icon={AlertCircleIcon}
                size={13}
                strokeWidth={1.8}
              />
              AI 没写进文章的目标词
            </div>
            <ul className="space-y-1 text-sm">
              {uncovered.map((w) => (
                <li
                  key={`${w.word_id}-${w.spelling}`}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="font-heading font-medium">{w.spelling}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {w.translation}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground">
              重新生成一次或降低目标词数通常能提高命中。
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface FinishBarProps {
  coveredCount: number
  onMasterAll: () => void
  onRegenerate: () => void
  isRegenerating: boolean
  onExport: () => void
}

function FinishBar({
  coveredCount,
  onMasterAll,
  onRegenerate,
  isRegenerating,
  onExport,
}: FinishBarProps) {
  return (
    <section className="rounded-2xl border border-border/60 bg-muted/30 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-heading text-sm font-medium">读完了？</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            把命中的 {coveredCount} 个词一次性标记已掌握，或换一篇继续练。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={coveredCount === 0}>
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  data-icon="inline-start"
                  strokeWidth={1.8}
                />
                标记 {coveredCount} 词已掌握
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认批量标记已掌握？</AlertDialogTitle>
                <AlertDialogDescription>
                  这 {coveredCount} 个词会从薄弱词列表消失，下次生成文章也不再优先挑选。
                  标记后会弹出撤销提示，可以在几秒内回退。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={onMasterAll}>
                  全部标记
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button asChild variant="outline" size="sm">
            <Link to="/vocab/weak">
              <span className="hidden sm:inline">继续刷薄弱词</span>
              <span className="sm:hidden">薄弱词</span>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                data-icon="inline-end"
                strokeWidth={1.8}
              />
            </Link>
          </Button>

          <Button variant="ghost" size="sm" onClick={onExport}>
            <HugeiconsIcon
              icon={Download04Icon}
              data-icon="inline-start"
              strokeWidth={1.8}
            />
            导出
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={isRegenerating}>
                <HugeiconsIcon
                  icon={isRegenerating ? RefreshIcon : SparklesIcon}
                  data-icon="inline-start"
                  strokeWidth={1.8}
                  className={cn(isRegenerating && "animate-spin")}
                />
                {isRegenerating ? "重新生成中…" : "再来一篇"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>使用相同参数重新生成？</AlertDialogTitle>
                <AlertDialogDescription>
                  新文章会作为独立条目保存在历史里，当前这篇不变。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={onRegenerate}>
                  重新生成
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </section>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      <span className="truncate text-right">{value}</span>
    </div>
  )
}

// --------------------------------------------------------------------------------
// Highlight + render logic
// --------------------------------------------------------------------------------

interface Segment {
  kind: "text" | "target"
  text: string
  /** Populated for target segments. */
  word?: ArticleWord
}

/**
 * Slice the article body into plain text + target spans driven by
 * `char_offset` / `char_length` (Unicode code points). Overlapping targets are
 * resolved by preferring the first-registered one.
 */
function buildSegments(body: string, words: ArticleWord[]): Segment[] {
  const codepoints = Array.from(body)
  const marks = words
    .filter((w) => w.char_offset >= 0 && w.char_length > 0)
    .slice()
    .sort((a, b) => a.char_offset - b.char_offset)

  const segments: Segment[] = []
  let cursor = 0
  for (const mark of marks) {
    if (mark.char_offset < cursor) continue // skip overlapping entries
    if (mark.char_offset > cursor) {
      segments.push({
        kind: "text",
        text: codepoints.slice(cursor, mark.char_offset).join(""),
      })
    }
    const end = mark.char_offset + mark.char_length
    segments.push({
      kind: "target",
      text: codepoints.slice(mark.char_offset, end).join(""),
      word: mark,
    })
    cursor = end
  }
  if (cursor < codepoints.length) {
    segments.push({ kind: "text", text: codepoints.slice(cursor).join("") })
  }
  return segments
}

/**
 * Split segment list across paragraph boundaries (double newline) and render
 * each paragraph with highlighted targets inlined.
 */
function renderParagraphs(
  segments: Segment[],
  articleId: string,
  wordIndex: Map<string, VocabWord>,
  onMaster: (wordId: string, spelling: string) => void,
  onSpeak: (text: string) => void,
) {
  const paragraphs: Segment[][] = [[]]
  for (const seg of segments) {
    if (seg.kind === "target") {
      paragraphs[paragraphs.length - 1]!.push(seg)
      continue
    }
    const parts = seg.text.split(/\n{2,}/)
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) paragraphs.push([])
      const text = parts[i]!
      if (text.length > 0) {
        paragraphs[paragraphs.length - 1]!.push({ kind: "text", text })
      }
    }
  }

  return paragraphs
    .filter((p) => p.some((s) => s.text.trim().length > 0))
    .map((p, pi) => (
      <p key={pi}>
        {p.map((seg, si) =>
          seg.kind === "target" ? (
            <TargetMark
              key={si}
              segment={seg}
              articleId={articleId}
              word={
                seg.word ? wordIndex.get(seg.word.word_id) ?? null : null
              }
              onMaster={onMaster}
              onSpeak={onSpeak}
            />
          ) : (
            <Fragment key={si}>{seg.text}</Fragment>
          ),
        )}
      </p>
    ))
}

interface TargetMarkProps {
  segment: Segment
  articleId: string
  word: VocabWord | null
  onMaster: (wordId: string, spelling: string) => void
  onSpeak: (text: string) => void
}

function TargetMark({
  segment,
  articleId,
  word,
  onMaster,
  onSpeak,
}: TargetMarkProps) {
  const aw = segment.word
  if (!aw) {
    return <>{segment.text}</>
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <mark
          id={targetDomId(articleId, aw.word_id)}
          tabIndex={0}
          aria-label={`目标词 ${aw.spelling}`}
          className={cn(
            // Slightly darker body fill + a thin coloured outline lifts the
            // target to AA contrast against both light and dark backgrounds.
            "cursor-pointer rounded-md px-0.5 font-medium outline-offset-2 ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-foreground",
            word?.mastered
              ? "bg-emerald-200/80 text-emerald-950 ring-emerald-500/40 dark:bg-emerald-400/25 dark:text-emerald-100"
              : "bg-amber-300/80 text-amber-950 ring-amber-500/50 hover:bg-amber-300 dark:bg-amber-400/35 dark:text-amber-50 dark:hover:bg-amber-400/50",
          )}
        >
          {segment.text}
        </mark>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[70vh] w-80 space-y-3 overflow-y-auto"
      >
        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="font-heading text-base font-semibold">
                {aw.spelling}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`朗读 ${aw.spelling}`}
                className="translate-y-0.5"
                onClick={() => onSpeak(aw.spelling)}
              >
                <HugeiconsIcon icon={VolumeHighIcon} strokeWidth={1.8} />
              </Button>
            </div>
            {word && <LastResponseBadge value={word.last_response} />}
          </div>
          <div className="text-sm text-muted-foreground">{aw.translation}</div>
        </div>

        {word?.example_sentence && (
          <blockquote className="border-l-2 border-border/60 pl-3 text-xs leading-relaxed text-muted-foreground italic">
            {word.example_sentence}
          </blockquote>
        )}

        {word?.synonyms && word.synonyms.length > 0 && (
          <MetaRow label="近义词">
            <div className="flex flex-wrap gap-1">
              {word.synonyms.map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="text-[11px] font-normal"
                >
                  {s}
                </Badge>
              ))}
            </div>
          </MetaRow>
        )}

        {word?.root_note && (
          <MetaRow label="词根">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {word.root_note}
            </p>
          </MetaRow>
        )}

        {word && (
          <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
            <span>
              weak{" "}
              <span className="font-heading text-foreground tabular-nums">
                {word.weak_score}
              </span>
            </span>
            <span>练习 {word.study_count} 次</span>
            {word.recently_covered_count != null &&
              word.recently_covered_count > 1 && (
                <span>近期覆盖 {word.recently_covered_count} 次</span>
              )}
          </div>
        )}

        {word?.related_article_ids &&
          word.related_article_ids.length > 1 && (
            <RelatedArticles
              currentArticleId={articleId}
              relatedIds={word.related_article_ids}
            />
          )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={word?.mastered}
            onClick={() => onMaster(aw.word_id, aw.spelling)}
          >
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              data-icon="inline-start"
              strokeWidth={1.8}
            />
            {word?.mastered ? "已掌握" : "标记已掌握"}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="加入笔记本 (v1)"
                disabled
              >
                <HugeiconsIcon
                  icon={BookmarkAdd02Icon}
                  data-icon="inline-start"
                  strokeWidth={1.8}
                />
                笔记本
              </Button>
            </TooltipTrigger>
            <TooltipContent>v1 开放，敬请期待</TooltipContent>
          </Tooltip>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function MetaRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </div>
      {children}
    </div>
  )
}

interface RelatedArticlesProps {
  currentArticleId: string
  relatedIds: string[]
}

function RelatedArticles({
  currentArticleId,
  relatedIds,
}: RelatedArticlesProps) {
  const { data: articles = [] } = useQuery({
    queryKey: ["articles", "list"],
    queryFn: async () => mockStore.listArticles(),
  })
  const others = articles.filter(
    (a) => relatedIds.includes(a.id) && a.id !== currentArticleId,
  )
  if (others.length === 0) return null
  return (
    <div className="space-y-1 border-t border-border/60 pt-2">
      <div className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
        也在这些文章里
      </div>
      <ul className="space-y-1">
        {others.slice(0, 3).map((a) => (
          <li key={a.id}>
            <Link
              to={`/articles/${a.id}`}
              className="group flex items-baseline gap-2 text-xs leading-snug"
            >
              <span className="truncate font-medium group-hover:underline">
                {a.title}
              </span>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={12}
                strokeWidth={1.8}
                className="translate-y-0.5 text-muted-foreground"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
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
