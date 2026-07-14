import {
  ArrowRight01Icon,
  Notebook02Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo } from "react"
import { Link } from "react-router-dom"

import { ArticleMeta } from "@/components/articles/ArticleMeta"
import { SectionPanel } from "@/components/common/SectionPanel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatRelativeTime } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import type { Article } from "@/types/api"

export interface RecentArticlesProps {
  articles: Article[]
  isLoading?: boolean
}

function readingRank(article: Article): number {
  const status = article.progress?.status
  if (status === "reading" || (!article.read && status !== "read")) {
    if (status === "reading") return 0
    if (!article.read) return 1
  }
  if (article.read || status === "read") return 3
  return 2
}

function progressLabel(article: Article): string | null {
  const status = article.progress?.status
  const pct = article.progress?.progress_percent
  if (status === "reading" || (pct != null && pct > 0 && pct < 100)) {
    return pct != null && pct > 0 ? `读到 ${pct}%` : "阅读中"
  }
  if (article.read || status === "read") return "已读"
  if (status === "unread" || !article.read) return "未读"
  return null
}

export function RecentArticles({ articles, isLoading }: RecentArticlesProps) {
  const ordered = useMemo(() => {
    return [...articles].sort((a, b) => {
      const rank = readingRank(a) - readingRank(b)
      if (rank !== 0) return rank
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    })
  }, [articles])

  return (
    <SectionPanel
      title={
        <>
          <HugeiconsIcon icon={Notebook02Icon} size={16} strokeWidth={1.8} />
          阅读队列
        </>
      }
      action={
        <Button asChild variant="ghost" size="sm">
          <Link to="/articles">
            全部
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              data-icon="inline-end"
              strokeWidth={1.8}
            />
          </Link>
        </Button>
      }
    >
      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          加载中…
        </p>
      ) : ordered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            还没有文章。用薄弱词生成第一篇吧。
          </p>
          <Button asChild size="sm">
            <Link to="/articles/new">
              <HugeiconsIcon
                icon={SparklesIcon}
                data-icon="inline-start"
                strokeWidth={1.8}
              />
              生成第一篇
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {ordered.map((article) => {
            const label = progressLabel(article)
            const done = label === "已读"
            return (
              <li key={article.id}>
                <Link
                  to={`/articles/${article.id}`}
                  className={cn(
                    "group -mx-2 flex flex-col gap-2 rounded-xl px-2 py-3 transition-colors hover:bg-muted/60",
                    done && "opacity-70"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <div className="font-heading text-sm leading-snug font-medium group-hover:underline">
                        {article.title}
                      </div>
                      {label && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-5 shrink-0 px-1.5 text-[10px]",
                            label === "未读" &&
                              "border-primary/30 bg-primary/5 text-foreground",
                            label.startsWith("读到") &&
                              "border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300",
                            done && "text-muted-foreground"
                          )}
                        >
                          {label}
                        </Badge>
                      )}
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(article.created_at)}
                    </div>
                  </div>
                  <ArticleMeta
                    article={article}
                    density="compact"
                    showRelativeTime={false}
                  />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </SectionPanel>
  )
}
