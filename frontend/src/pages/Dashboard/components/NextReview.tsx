import {
  AlertCircleIcon,
  ArrowRight01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "react-router-dom"

import { LastResponseBadge } from "@/components/common/LastResponseBadge"
import { SectionPanel } from "@/components/common/SectionPanel"
import { StickingBadge } from "@/components/common/StickingBadge"
import { WeakScoreMeter } from "@/components/common/WeakScoreMeter"
import { Button } from "@/components/ui/button"
import { hasStickingTag } from "@/lib/vocab-tags"
import type { WeakWord } from "@/types/api"

export interface NextReviewProps {
  words: WeakWord[]
  isLoading?: boolean
}

/**
 * Actionable weak-word preview: show top candidates and a path into generation.
 */
export function NextReview({ words, isLoading }: NextReviewProps) {
  return (
    <SectionPanel
      title={
        <>
          <HugeiconsIcon icon={AlertCircleIcon} size={16} strokeWidth={1.8} />
          本轮可练
        </>
      }
      action={
        <Button asChild variant="ghost" size="sm">
          <Link to="/vocab/weak">
            全部薄弱词
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
      ) : words.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            没有待复习的薄弱词。可以同步墨墨或直接生成一篇。
          </p>
          <Button asChild size="sm" variant="outline">
            <Link to="/articles/new">生成文章</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="divide-y divide-border/60">
            {words.map((word) => (
              <li
                key={word.id}
                className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <div className="truncate font-heading text-base font-medium tracking-tight">
                    {word.spelling}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <LastResponseBadge value={word.last_response} />
                    {hasStickingTag(word.tags) && <StickingBadge />}
                    <span className="text-[11px] text-muted-foreground">
                      练习 {word.study_count} 次
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end">
                  <WeakScoreMeter score={word.weak_score} variant="compact" />
                  <div className="text-[10px] tracking-wider text-muted-foreground uppercase">
                    weak
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
            <Button asChild size="sm" className="flex-1 sm:flex-none">
              <Link
                to={
                  words.length > 0
                    ? `/articles/new?target_word_ids=${words.map((w) => w.id).join(",")}`
                    : "/articles/new"
                }
              >
                <HugeiconsIcon
                  icon={SparklesIcon}
                  data-icon="inline-start"
                  strokeWidth={1.8}
                />
                用这 {words.length} 个生成
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="flex-1 sm:flex-none">
              <Link to="/vocab/weak">挑选 / 推荐 20 词</Link>
            </Button>
          </div>
        </div>
      )}
    </SectionPanel>
  )
}
