import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Download04Icon,
  RefreshIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Fragment, useEffect, useMemo, useRef } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"

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
  // example_sentence / weak_score / mastered flag that `article_words` lacks.
  const { data: words = [] } = useQuery({
    queryKey: ["vocab", "words"],
    queryFn: async () => mockStore.listWords(),
  })
  const wordIndex = useMemo(() => {
    const map = new Map<string, VocabWord>()
    for (const w of words) map.set(w.id, w)
    return map
  }, [words])

  const markRead = useMutation({
    mutationFn: async (articleId: string) => mockStore.markArticleRead(articleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] })
    },
  })

  const markMastered = useMutation({
    mutationFn: async ({ id: wordId }: { id: string; spelling: string }) =>
      mockStore.markWordMastered(wordId, true),
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
    onSuccess: ({ article_id }) => {
      queryClient.invalidateQueries({ queryKey: ["articles"] })
      navigate(`/articles/${article_id}`)
    },
  })

  // Auto-mark-as-read a few seconds after mount, so the dashboard's
  // "continue reading" card clears once the user actually opens the article.
  // A ref gates the one-shot so we don't trigger the mutation again on every
  // article.read re-render.
  const markedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!article || article.read) return
    if (markedRef.current === article.id) return
    const articleId = article.id
    const t = setTimeout(() => {
      markedRef.current = articleId
      markRead.mutate(articleId)
    }, 2500)
    return () => clearTimeout(t)
    // `markRead` is stable from react-query; avoid re-subscribing on every
    // render by excluding it from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article])

  const segments = useMemo(() => {
    if (!article) return []
    return buildSegments(article.content_markdown, article.article_words)
  }, [article])

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

  const scrollToTarget = (wordId: string) => {
    const el = document.getElementById(targetDomId(article.id, wordId))
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    el.classList.add("ring-2", "ring-offset-2", "ring-amber-400")
    window.setTimeout(
      () => el.classList.remove("ring-2", "ring-offset-2", "ring-amber-400"),
      1400,
    )
  }

  const masterAll = () => {
    for (const w of covered) {
      mockStore.markWordMastered(w.word_id, true)
    }
    queryClient.invalidateQueries({ queryKey: ["vocab"] })
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
  }

  return (
    <div className="space-y-6">
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

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Reading pane */}
        <div className="space-y-4 lg:col-span-3">
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

          <article className="rounded-3xl bg-card p-6 text-[15px] leading-[1.9] text-card-foreground ring-1 ring-foreground/5 sm:p-8">
            <div className="space-y-4">
              {renderParagraphs(
                segments,
                article.id,
                wordIndex,
                (wordId) => markMastered.mutate({ id: wordId, spelling: "" }),
              )}
            </div>
          </article>

          {/* Finish-reading action bar */}
          <FinishBar
            coveredCount={covered.length}
            onMasterAll={masterAll}
            onRegenerate={() => regenerate.mutate(article)}
            isRegenerating={regenerate.isPending}
            onExport={handleExport}
            articleId={article.id}
          />
        </div>

        {/* Side panel */}
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
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------------
// Subcomponents
// --------------------------------------------------------------------------------

function targetDomId(articleId: string, wordId: string): string {
  return `target-${articleId}-${wordId}`
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
}

function CoverageList({
  covered,
  uncovered,
  wordIndex,
  onScrollTo,
  onMaster,
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
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`标记 ${w.spelling} 已掌握`}
                    className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
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
  articleId: string
}

function FinishBar({
  coveredCount,
  onMasterAll,
  onRegenerate,
  isRegenerating,
  onExport,
  articleId: _articleId,
}: FinishBarProps) {
  void _articleId
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
                  稍后随时可以在「全部单词」里把它们改回来。
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
              继续刷薄弱词
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
  onMaster: (wordId: string) => void,
) {
  // Flatten into a linear `(kind, text)` list, then split text nodes on `\n\n`.
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
  onMaster: (wordId: string) => void
}

function TargetMark({ segment, articleId, word, onMaster }: TargetMarkProps) {
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
          className={cn(
            "cursor-pointer rounded-md px-0.5 font-medium transition-colors",
            word?.mastered
              ? "bg-emerald-500/10 text-emerald-900 dark:text-emerald-300"
              : "bg-amber-200/80 text-amber-950 hover:bg-amber-300/80 dark:bg-amber-400/20 dark:text-amber-200 dark:hover:bg-amber-400/30",
          )}
        >
          {segment.text}
        </mark>
      </PopoverTrigger>
      <PopoverContent align="start" className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-heading text-base font-semibold">
              {aw.spelling}
            </span>
            {word && <LastResponseBadge value={word.last_response} />}
          </div>
          <div className="text-sm text-muted-foreground">{aw.translation}</div>
        </div>

        {word?.example_sentence && (
          <blockquote className="border-l-2 border-border/60 pl-3 text-xs leading-relaxed text-muted-foreground italic">
            {word.example_sentence}
          </blockquote>
        )}

        {word && (
          <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
            <span>
              weak{" "}
              <span className="font-heading text-foreground tabular-nums">
                {word.weak_score}
              </span>
            </span>
            <span>
              练习 {word.study_count} 次
            </span>
            {word.recently_covered_count != null &&
              word.recently_covered_count > 1 && (
                <span>近期覆盖 {word.recently_covered_count} 次</span>
              )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={word?.mastered}
            onClick={() => onMaster(aw.word_id)}
          >
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              data-icon="inline-start"
              strokeWidth={1.8}
            />
            {word?.mastered ? "已掌握" : "标记已掌握"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
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
