import {
  AlertCircleIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  BookOpen02Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { useEffect, useMemo, useRef, useState } from "react"
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
   * renders a neutral skeleton so the user doesn't see a flashed "同步异常"
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
    card: "bg-card ring-1 ring-destructive/30",
    icon: "bg-destructive/10 text-destructive",
    eyebrow: "text-destructive",
    button: "default",
  },
}

function syncPlan(summary: VocabSummary | undefined): Plan {
  const last = summary?.last_synced_at
  return {
    id: "sync",
    tone: "sync",
    icon: AlertCircleIcon,
    eyebrow: "同步异常",
    headline: "先把墨墨数据同步到最新",
    description: last
      ? `上次同步 ${formatRelativeTime(last)}。生成和薄弱词推荐都依赖这份数据。`
      : "还没有同步过墨墨的学习数据。当前薄弱词列表可能不代表你的真实进度。",
    primaryLabel: "重新同步",
    primaryTo: "/dashboard",
    secondaryLabel: "稍后再说",
    secondaryTo: "/articles",
  }
}

function continuePlan(unread: Article): Plan {
  return {
    id: "continue",
    tone: "primary",
    icon: BookOpen02Icon,
    eyebrow: "还没读完",
    headline: `继续阅读《${unread.title}》`,
    description: `${formatArticleLength(unread.article_length)} · 覆盖 ${formatCoverage(unread.coverage_rate)} · ${formatRelativeTime(unread.created_at)}生成`,
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
      ? "生成一篇覆盖 30 个左右薄弱词的文章，用阅读一次把它们复习过去。"
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
    eyebrow: "今日推荐",
    headline: "用薄弱词生成一篇新文章",
    description:
      "LexiForge 会从你的墨墨学习数据里挑出最薄弱的词，写一段带语境的英文短文。",
    primaryLabel: "生成新文章",
    primaryTo: "/articles/new",
    secondaryLabel: "看薄弱词",
    secondaryTo: "/vocab/weak",
  }
}

function computeRecommendedPlan(
  summary: VocabSummary | undefined,
  unread: Article | null | undefined
): Plan {
  // 1. Stale sync takes highest priority: without fresh data nothing else is useful.
  if (isSyncStale(summary?.last_synced_at)) return syncPlan(summary)

  // 2. Unread article → continue reading.
  if (unread) return continuePlan(unread)

  // 3. Large weak backlog → generate a targeted article.
  const weakCount = summary?.weak ?? 0
  if (weakCount >= 20) return weakPlan(weakCount)

  // 4. Default: nudge to generate something.
  return generatePlan()
}

function computeCandidatePlans(
  summary: VocabSummary | undefined,
  unread: Article | null | undefined
): Plan[] {
  const recommended = computeRecommendedPlan(summary, unread)
  const candidates: Plan[] = []

  if (isSyncStale(summary?.last_synced_at)) candidates.push(syncPlan(summary))
  if (unread) candidates.push(continuePlan(unread))

  const weakCount = summary?.weak ?? 0
  if (weakCount > 0) candidates.push(weakPlan(weakCount))

  candidates.push(generatePlan())

  return [
    recommended,
    ...candidates.filter((plan) => plan.id !== recommended.id),
  ]
}

export function NextAction({
  summary,
  unreadArticle,
  isLoading,
  isSyncing = false,
  syncCooldownRemaining = 0,
  onSync,
}: NextActionProps) {
  const plans = useMemo(
    () => computeCandidatePlans(summary, unreadArticle),
    [summary, unreadArticle]
  )
  const planSignature = `${plans[0]?.id ?? "none"}:${plans.length}`
  const [carousel, setCarousel] = useState({
    activeIndex: 0,
    planSignature,
  })
  if (carousel.planSignature !== planSignature) {
    setCarousel({ activeIndex: 0, planSignature })
  }
  const activeIndex = Math.min(carousel.activeIndex, plans.length - 1)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    scrollerRef.current?.scrollTo({ left: 0 })
  }, [planSignature])

  // While the summary is still loading we can't tell whether the user is in
  // the "sync stale" branch or not. Render a neutral skeleton to avoid a
  // flash of the destructive "同步异常" card on first mount.
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

  const goToPlan = (index: number) => {
    const next = Math.max(0, Math.min(plans.length - 1, index))
    setCarousel({ activeIndex: next, planSignature })
    const scroller = scrollerRef.current
    const card = scroller?.querySelector<HTMLElement>(
      `[data-plan-card="${next}"]`
    )
    card?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    })
  }

  const handleScroll = () => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const cards = Array.from(
      scroller.querySelectorAll<HTMLElement>("[data-plan-card]")
    )
    if (cards.length === 0) return

    const viewportCenter = scroller.scrollLeft + scroller.clientWidth / 2
    let bestIdx = activeIndex
    let bestDistance = Number.POSITIVE_INFINITY
    cards.forEach((card, idx) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2
      const distance = Math.abs(cardCenter - viewportCenter)
      if (distance < bestDistance) {
        bestDistance = distance
        bestIdx = idx
      }
    })
    if (bestIdx !== activeIndex) {
      setCarousel({ activeIndex: bestIdx, planSignature })
    }
  }

  return (
    <div className="space-y-3">
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {plans.map((plan, idx) => (
          <div
            key={plan.id}
            data-plan-card={idx}
            className="min-w-[calc(100%-1.5rem)] snap-start sm:min-w-full"
          >
            <PlanCard
              plan={plan}
              isSyncing={isSyncing}
              syncCooldownRemaining={syncCooldownRemaining}
              onSync={onSync}
            />
          </div>
        ))}
      </div>

      {plans.length > 1 && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {plans.map((plan, idx) => (
              <button
                key={plan.id}
                type="button"
                aria-current={idx === activeIndex ? "true" : undefined}
                aria-label={`切换到第 ${idx + 1} 张下一步卡片`}
                onClick={() => goToPlan(idx)}
                className="grid h-7 min-w-7 place-items-center rounded-full transition-colors hover:bg-muted/60"
              >
                <span
                  className={cn(
                    "h-1.5 rounded-full transition-[width,background-color]",
                    idx === activeIndex
                      ? "w-6 bg-foreground"
                      : "w-1.5 bg-muted-foreground/35"
                  )}
                />
              </button>
            ))}
          </div>

          <div className="hidden items-center gap-1 sm:flex">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="上一张下一步卡片"
              disabled={activeIndex === 0}
              onClick={() => goToPlan(activeIndex - 1)}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={1.8} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="下一张下一步卡片"
              disabled={activeIndex === plans.length - 1}
              onClick={() => goToPlan(activeIndex + 1)}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={1.8} />
            </Button>
          </div>
        </div>
      )}
    </div>
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
        "relative flex min-h-[236px] overflow-hidden rounded-3xl p-6 sm:min-h-[204px] sm:p-8",
        tone.card
      )}
    >
      <div className="flex w-full flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
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
            <h2
              className="line-clamp-2 font-heading text-xl leading-tight font-semibold tracking-tight text-foreground sm:text-2xl"
            >
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
