import {
  ArrowRight01Icon,
  Notebook02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "react-router-dom"

import { ArticleMeta } from "@/components/articles/ArticleMeta"
import { SectionPanel } from "@/components/common/SectionPanel"
import { Button } from "@/components/ui/button"
import { formatRelativeTime } from "@/lib/formatters"
import type { Article } from "@/types/api"

export interface RecentArticlesProps {
  articles: Article[]
}

export function RecentArticles({ articles }: RecentArticlesProps) {
  return (
    <SectionPanel
      title={
        <>
          <HugeiconsIcon icon={Notebook02Icon} size={16} strokeWidth={1.8} />
          最近生成的文章
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
      {articles.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          还没有文章。点上方&quot;生成新文章&quot;开始第一篇。
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {articles.map((article) => (
            <li key={article.id}>
              <Link
                to={`/articles/${article.id}`}
                className="group -mx-2 flex flex-col gap-2 rounded-xl px-2 py-3 transition-colors hover:bg-muted/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="font-heading text-sm leading-snug font-medium group-hover:underline">
                    {article.title}
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
          ))}
        </ul>
      )}
    </SectionPanel>
  )
}
