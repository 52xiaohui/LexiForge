import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
  Download04Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Fragment, useMemo } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"

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
  formatArticleLength,
  formatCoverage,
  formatDifficulty,
  formatRelativeTime,
} from "@/lib/formatters"
import { mockStore } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import type { ArticleDetail, ArticleWord, CefrLevel } from "@/types/api"

export function ArticleDetail() {
  const { id = "" } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: article, isFetching } = useQuery({
    queryKey: ["articles", id],
    queryFn: async () => mockStore.getArticle(id),
    enabled: Boolean(id),
  })

  const regenerate = useMutation({
    mutationFn: async (source: ArticleDetail) => {
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

  const uncovered = article.article_words.filter((w) => !w.is_covered)

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
              {renderParagraphs(segments)}
            </div>
          </article>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <HugeiconsIcon
                icon={Download04Icon}
                data-icon="inline-start"
                strokeWidth={1.8}
              />
              导出 Markdown
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={regenerate.isPending}>
                  <HugeiconsIcon
                    icon={RefreshIcon}
                    data-icon="inline-start"
                    strokeWidth={1.8}
                    className={cn(regenerate.isPending && "animate-spin")}
                  />
                  {regenerate.isPending ? "重新生成中…" : "重新生成"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>使用相同参数重新生成？</AlertDialogTitle>
                  <AlertDialogDescription>
                    新文章会作为独立条目保存在历史里，旧文章不变。
                    主题「{article.topic}」/ 难度 {formatDifficulty(article.difficulty)} /
                    长度 {formatArticleLength(article.article_length)} /
                    目标词数 {article.target_word_count}。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={() => regenerate.mutate(article)}>
                    重新生成
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <aside className="space-y-4 lg:col-span-2">
          <Card size="sm">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  size={16}
                  strokeWidth={1.8}
                />
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

          {uncovered.length > 0 && (
            <Card size="sm">
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <HugeiconsIcon
                    icon={AlertCircleIcon}
                    size={16}
                    strokeWidth={1.8}
                  />
                  未覆盖目标词
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  AI 没把这些词写进文章。重新生成一次或降低目标词数可能有帮助。
                </p>
                <ul className="space-y-1 text-sm">
                  {uncovered.map((w) => (
                    <li
                      key={`${w.word_id}-${w.spelling}`}
                      className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1 last:border-0"
                    >
                      <span className="font-heading font-medium">{w.spelling}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {w.translation}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

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
function renderParagraphs(segments: Segment[]) {
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
            <TargetMark key={si} segment={seg} />
          ) : (
            <Fragment key={si}>{seg.text}</Fragment>
          ),
        )}
      </p>
    ))
}

function TargetMark({ segment }: { segment: Segment }) {
  return (
    <mark
      className="rounded-md bg-amber-200/80 px-0.5 font-medium text-amber-950 dark:bg-amber-400/20 dark:text-amber-200"
      title={segment.word?.translation ?? undefined}
    >
      {segment.text}
    </mark>
  )
}

function buildMarkdown(article: ArticleDetail): string {
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
