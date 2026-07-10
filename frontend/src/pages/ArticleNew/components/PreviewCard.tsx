import { Target02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "react-router-dom"

import { LastResponseBadge } from "@/components/common/LastResponseBadge"
import { SectionPanel } from "@/components/common/SectionPanel"
import { StickingBadge } from "@/components/common/StickingBadge"
import { Badge } from "@/components/ui/badge"
import { formatArticleLength } from "@/lib/formatters"
import { LAST_RESPONSE_ORDER } from "@/lib/last-response"
import { hasStickingTag } from "@/lib/vocab-tags"
import { cn } from "@/lib/utils"
import type { ArticleLength, LastResponse } from "@/types/api"

const recommendationReasonLabels: Record<string, string> = {
  external_weak_score: "外部薄弱分",
  pinned: "已置顶",
  failed_in_context: "近期语境失败",
  recognized_in_context: "近期语境识别",
  recent_article_exposure: "近期文章已曝光",
}

function recommendationHint(word: {
  recommendation_score?: number
  recommendation_reasons?: Record<string, number>
}): string | undefined {
  if (word.recommendation_score == null) return undefined
  const reasons = Object.entries(word.recommendation_reasons ?? {})
    .map(([key, value]) => {
      const label = recommendationReasonLabels[key] ?? key
      return `${label} ${value >= 0 ? "+" : ""}${value}`
    })
    .join("，")
  return `推荐分 ${word.recommendation_score}${reasons ? `：${reasons}` : ""}`
}

export interface PreviewCardProps {
  words: {
    id: string
    spelling: string
    last_response: LastResponse
    tags: string[]
    recommendation_score?: number
    recommendation_reasons?: Record<string, number>
  }[]
  countsByResponse: Record<LastResponse, number> | undefined
  stickingCount: number
  autoFillCount: number
  isAuto: boolean
  totalPicked: number
  targetCount: number
  recommendedLength: ArticleLength | null
}

export function PreviewCard({
  words,
  countsByResponse,
  stickingCount,
  autoFillCount,
  isAuto,
  totalPicked,
  targetCount,
  recommendedLength,
}: PreviewCardProps) {
  const planSize = words.length
  return (
    <SectionPanel
      title={
        <>
          <HugeiconsIcon icon={Target02Icon} size={16} strokeWidth={1.8} />
          覆盖预览
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-xs tracking-wider text-muted-foreground uppercase">
            计划覆盖
          </div>
          <div>
            <span className="font-heading text-2xl font-semibold tabular-nums">
              {planSize}
            </span>
            <span className="text-xs text-muted-foreground">
              {" "}
              / {targetCount}
            </span>
          </div>
        </div>

        {countsByResponse && planSize > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {LAST_RESPONSE_ORDER.map((resp) => {
              const c = countsByResponse[resp] ?? 0
              if (c === 0) return null
              return (
                <div
                  key={resp}
                  className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px]"
                >
                  <LastResponseBadge
                    value={resp}
                    className="border-0 bg-transparent px-0"
                  />
                  <span className="tabular-nums">{c}</span>
                </div>
              )
            })}
            {stickingCount > 0 && (
              <div className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px]">
                <StickingBadge className="border-0 bg-transparent px-0" />
                <span className="tabular-nums">{stickingCount}</span>
              </div>
            )}
          </div>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          {isAuto ? (
            <>
              当前是自动选词模式，后端会按{" "}
              <span className="text-foreground">
                推荐优先 / 巩固 / 最近学习
              </span>
              三层候选池挑选，并用阅读反馈动态调整顺序。
            </>
          ) : (
            <>
              来自薄弱词页勾选共 {totalPicked} 个。
              {autoFillCount > 0 && (
                <> 还差 {autoFillCount} 个名额，后端会按比例自动补足。</>
              )}
            </>
          )}
        </p>

        {planSize > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {words.slice(0, 24).map((w) => (
              <Badge
                key={w.id}
                variant="outline"
                title={recommendationHint(w)}
                className={cn(
                  "text-[11px]",
                  hasStickingTag(w.tags) &&
                    "border-amber-500/40 text-amber-700 dark:text-amber-400"
                )}
              >
                {w.spelling}
                {w.recommendation_score != null && (
                  <span className="ml-1 text-[9px] text-muted-foreground tabular-nums">
                    {w.recommendation_score}
                  </span>
                )}
              </Badge>
            ))}
            {planSize > 24 && (
              <Badge
                variant="outline"
                className="text-[11px] text-muted-foreground"
              >
                +{planSize - 24}
              </Badge>
            )}
          </div>
        )}

        {recommendedLength && (
          <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
            推荐长度：
            <span className="text-foreground">
              {" "}
              {formatArticleLength(recommendedLength)}
            </span>
            · 不够时可以回{" "}
            <Link
              to="/vocab/weak"
              className="underline underline-offset-4 hover:text-foreground"
            >
              薄弱词页
            </Link>{" "}
            增减。
          </p>
        )}
      </div>
    </SectionPanel>
  )
}
