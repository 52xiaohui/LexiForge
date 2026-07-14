import {
  AlertCircleIcon,
  ArrowRight01Icon,
  BookOpen02Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { useMemo } from "react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  formatArticleLength,
  formatCoverage,
  formatRelativeTime,
} from "@/lib/formatters"
import { isSyncStale } from "@/lib/sync"
import { cn } from "@/lib/utils"
import type { Article, VocabSummary } from "@/types/api"

export interface NextActionProps {
  summary: VocabSummary | undefined
  unreadArticle: Article | null | undefined
  isSyncing?: boolean
  syncCooldownRemaining?: number
  onSync?: () => void
  /**
   * When true, the vocab summary query is still fetching. The component
   * renders a neutral skeleton so the user doesn't see a flashed stale-sync
   * card before the real state is known.
   */
  isLoading?: boolean
}

type Tone = "primary" | "sync" | "generate"
type PlanId = "sync" | "continue" | "weak" | "generate"

interface Plan {
  id: PlanId
  tone: Tone
  icon: IconSvgElement
  eyebrow: string
  headline: string
  description: string
  primaryLabel: string
  primaryTo: string
  secondaryLabel?: string
  secondaryTo?: string
}

const toneStyles: Record<
  Tone,
  {
    card: string
    icon: string
    eyebrow: string
    button: "default" | "outline" | "secondary"
  }
> = {
  primary: {
    card: "bg-card ring-1 ring-foreground/10",
    icon: "bg-foreground text-background",
    eyebrow: "text-muted-foreground",
    button: "default",
  },
  generate: {
    card: "bg-card ring-1 ring-foreground/10",
    icon: "bg-foreground text-background",
    eyebrow: "text-muted-foreground",
    button: "default",
  },
  sync: {
    card: "bg-card ring-1 ring-amber-500/35",
    icon: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    eyebrow: "text-amber-700 dark:text-amber-400",
    button: "default",
  },
}

function syncPlan(summary: VocabSummary | undefined): Plan {
  const last = summary?.last_synced_at
  return {
    id: "sync",
    tone: "sync",
    icon: AlertCircleIcon,
    eyebrow: last ? "数据可能过期" : "还没同步过",
    headline: last
      ? "先把墨墨数据同步到最新"
      : "先同步墨墨学习数据",
    description: last
      ? `上次同步 ${formatRelativeTime(last)}。生成和薄弱词推荐都依赖这份数据。`
      : "还没有同步过墨墨的学习数据。同步后才能看到真实的薄弱词和推荐。",
    primaryLabel: last ? "立即同步" : "开始同步",
    primaryTo: "/dashboard",
    // Keep the learning loop unblocked: stale data is a warning, not a hard stop.
    secondaryLabel: "仍要生成一篇",
    secondaryTo: "/articles/new",
  }
}

function continuePlan(unread: Article): Plan {
  const progress = unread.progress?.progress_percent
  const progressHint =
    progress != null && progress > 0 ? ` · 已读 ${progress}%` : ""
  return {
    id: "continue",
    tone: "primary",
    icon: BookOpen02Icon,
    eyebrow: "继续阅读",
    headline: `继续阅读《${unread.title}》`,
    description: `${formatArticleLength(unread.article_length)} · 覆盖 ${formatCoverage(unread.coverage_rate)}${progressHint} · ${formatRelativeTime(unread.created_at)}生成`,
    primaryLabel: "继续阅读",
    primaryTo: `/articles/${unread.id}`,
    secondaryLabel: "再生成一篇",
    secondaryTo: "/articles/new",
  }
}

function weakPlan(weakCount: number): Plan {
  const largeBacklog = weakCount >= 20
  return {
    id: "weak",
    tone: "generate",
    icon: SparklesIcon,
    eyebrow: largeBacklog ? "薄弱词累积中" : "薄弱词练习",
    headline: largeBacklog
      ? `有 ${weakCount} 个薄弱词等着被练上`
      : `还有 ${weakCount} 个薄弱词可以重点练`,
    description: largeBacklog
      ? "生成一篇覆盖约 30 个薄弱词的短文，用阅读把它们复习过去。"
      : "先挑几个最想巩固的词，再生成一篇短文，阅读压力会更轻。",
    primaryLabel: largeBacklog ? "生成一篇" : "挑选薄弱词",
    primaryTo: largeBacklog ? "/articles/new" : "/vocab/weak",
    secondaryLabel: largeBacklog ? "去薄弱词挑选" : "直接生成",
    secondaryTo: largeBacklog ? "/vocab/weak" : "/articles/new",
  }
}

function generatePlan(): Plan {
  return {
    id: "generate",
    tone: "generate",
    icon: SparklesIcon,
    eyebrow: "下一步",
    headline: "用薄弱词生成一篇新文章",
    description:
      "LexiForge 会从你的墨墨学习数据里挑出最薄弱的词，写一段带语境的英文短文。",
    primaryLabel: "生成新文章",
    primaryTo: "/articles/new",
    secondaryLabel: "看薄弱词",
    secondaryTo: "/vocab/weak",
  }
}

/** Highest-priority single plan for the dashboard command surface. */
function computeRecommendedPlan(
  summary: VocabSummary | undefined,
  unread: Article | null | undefined
): Plan {
  // 1. Stale / missing sync — still offer generate as secondary on the card.
  if (isSyncStale(summary?.last_synced_at)) return syncPlan(summary)

  // 2. Unfinished article wins when data is fresh enough.
  if (unread) return continuePlan(unread)

  // 3. Empty reading queue + weak backlog → push generation hard.
  const weakCount = summary?.weak ?? 0
  if (weakCount >= 20) return weakPlan(weakCount)
  if (weakCount > 0) return weakPlan(weakCount)

  // 4. Default generate nudge.
  return generatePlan()
}

export function NextAction({
  summary,
  unreadArticle,
  isLoading,
  isSyncing = false,
  syncCooldownRemaining = 0,
  onSync,
}: NextActionProps) {
  const plan = useMemo(
    () => computeRecommendedPlan(summary, unreadArticle),
    [summary, unreadArticle]
  )

  if (isLoading && summary === undefined) {
    return (
      <section className="relative overflow-hidden rounded-3xl bg-card p-6 ring-1 ring-foreground/10 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-muted" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-20 rounded-full bg-muted" />
              <div className="h-6 w-3/4 rounded-full bg-muted" />
              <div className="h-4 w-full max-w-md rounded-full bg-muted/70" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:justify-end">
            <div className="h-9 w-28 rounded-full bg-muted" />
            <div className="h-9 w-24 rounded-full bg-muted/70" />
          </div>
        </div>
      </section>
    )
  }

  return (
    <PlanCard
      plan={plan}
      isSyncing={isSyncing}
      syncCooldownRemaining={syncCooldownRemaining}
      onSync={onSync}
    />
  )
}

function PlanCard({
  plan,
  isSyncing,
  syncCooldownRemaining,
  onSync,
}: {
  plan: Plan
  isSyncing: boolean
  syncCooldownRemaining: number
  onSync?: () => void
}) {
  const tone = toneStyles[plan.tone]
  const syncDisabled =
    plan.tone === "sync" && (isSyncing || syncCooldownRemaining > 0)
  const syncLabel = isSyncing
    ? "同步中"
    : syncCooldownRemaining > 0
      ? `${syncCooldownRemaining}s 后可同步`
      : plan.primaryLabel

  return (
    <article
      className={cn(
        "relative flex overflow-hidden rounded-3xl p-6 sm:p-8",
        tone.card
      )}
    >
      <div className="flex w-full flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-2xl",
              tone.icon
            )}
          >
            <HugeiconsIcon icon={plan.icon} size={20} strokeWidth={1.8} />
          </div>
          <div className="min-w-0 space-y-2">
            <div
              className={cn(
                "text-[10px] font-medium tracking-[0.2em] uppercase",
                tone.eyebrow
              )}
            >
              {plan.eyebrow}
            </div>
            <h2 className="line-clamp-2 font-heading text-xl leading-tight font-semibold tracking-tight text-foreground sm:text-2xl">
              {plan.headline}
            </h2>
            <p className="line-clamp-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:line-clamp-2">
              {plan.description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {plan.tone === "sync" && onSync ? (
            <Button
              size="default"
              variant={tone.button}
              disabled={syncDisabled}
              onClick={onSync}
            >
              {syncLabel}
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                data-icon="inline-end"
                strokeWidth={1.8}
              />
            </Button>
          ) : (
            <Button asChild size="default" variant={tone.button}>
              <Link to={plan.primaryTo}>
                {plan.primaryLabel}
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  data-icon="inline-end"
                  strokeWidth={1.8}
                />
              </Link>
            </Button>
          )}
          {plan.secondaryLabel && plan.secondaryTo && (
            <Button asChild size="default" variant="outline">
              <Link to={plan.secondaryTo}>{plan.secondaryLabel}</Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}
