import { Badge } from "@/components/ui/badge"
import {
  formatArticleLength,
  formatCoverage,
  formatDifficulty,
  formatRelativeTime,
} from "@/lib/formatters"
import { cn } from "@/lib/utils"
import type { Article } from "@/types/api"

export interface ArticleMetaProps {
  article: Pick<
    Article,
    | "difficulty"
    | "article_length"
    | "coverage_rate"
    | "covered_word_count"
    | "target_word_count"
    | "topic"
    | "created_at"
  >
  /**
   * `full` — list history (difficulty, length, coverage, counts, topic, time).
   * `compact` — dashboard recent (difficulty, coverage, counts; no length/topic).
   */
  density?: "full" | "compact"
  showRelativeTime?: boolean
  className?: string
}

/**
 * Shared article metadata chips/line used in history list and dashboard
 * recent articles so both surfaces stay visually aligned.
 */
export function ArticleMeta({
  article,
  density = "full",
  showRelativeTime = true,
  className,
}: ArticleMetaProps) {
  const sep = (
    <span aria-hidden className="text-muted-foreground">
      ·
    </span>
  )

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 text-xs text-muted-foreground",
        className
      )}
    >
      <Badge variant="outline" className="text-[10px]">
        {formatDifficulty(article.difficulty)}
      </Badge>
      {density === "full" && (
        <Badge variant="outline" className="text-[10px]">
          {formatArticleLength(article.article_length)}
        </Badge>
      )}
      <span>覆盖 {formatCoverage(article.coverage_rate)}</span>
      {sep}
      <span>
        {article.covered_word_count} / {article.target_word_count} 词
      </span>
      {density === "full" && (
        <>
          {sep}
          <span>{article.topic}</span>
        </>
      )}
      {showRelativeTime && density === "full" && (
        <>
          {sep}
          <span>{formatRelativeTime(article.created_at)}</span>
        </>
      )}
    </div>
  )
}
