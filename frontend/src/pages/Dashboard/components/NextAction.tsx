import {
  AlertCircleIcon,
  ArrowRight01Icon,
  BookOpen02Icon,
  CheckmarkCircle02Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  formatArticleLength,
  formatCoverage,
  formatRelativeTime,
} from "@/lib/formatters"
import { cn } from "@/lib/utils"
import type { Article, TodayProgress, VocabSummary } from "@/types/api"

export interface NextActionProps {
  summary: VocabSummary | undefined
  progress: TodayProgress | undefined
  unreadArticle: Article | null | undefined
  /**
   * When true, the vocab summary query is still fetching. The component
   * renders a neutral skeleton so the user doesn't see a flashed "同步异常"
   * card before the real state is known.
   */
  isLoading?: boolean
}

type Tone = "primary" | "sync" | "generate" | "done"

interface Plan {
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

const SYNC_STALE_HOURS = 24

const toneStyles: Record<
  Tone,
  { card: string; icon: string; eyebrow: string; button: "default" | "outline" | "secondary" }
> = {
  primary: {
    card: "bg-foreground text-background",
    icon: "bg-background/15 text-background",
    eyebrow: "text-background/70",
    button: "secondary",
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
  done: {
    card: "bg-card ring-1 ring-foreground/10",
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    eyebrow: "text-muted-foreground",
    button: "outline",
  },
}

function computePlan(
  summary: VocabSummary | undefined,
  progress: TodayProgress | undefined,
  unread: Article | null | undefined,
): Plan {
  // 1. Stale sync takes highest priority: without fresh data nothing else is useful.
  const lastSync = summary?.last_synced_at
    ? new Date(summary.last_synced_at).getTime()
    : null
  const staleMs = SYNC_STALE_HOURS * 60 * 60 * 1000
  if (!lastSync || Date.now() - lastSync > staleMs) {
    return {
      tone: "sync",
      icon: AlertCircleIcon,
      eyebrow: "同步异常",
      headline: "先把墨墨数据同步到最新",
      description: lastSync
        ? `上次同步 ${formatRelativeTime(summary!.last_synced_at)}。生成和薄弱词推荐都依赖这份数据。`
        : "还没有同步过墨墨的学习数据。当前薄弱词列表可能不代表你的真实进度。",
      primaryLabel: "重新同步",
      // Sync UI is MVP-gated; point at /dashboard for now so this stays safe.
      primaryTo: "/dashboard",
      secondaryLabel: "稍后再说",
      secondaryTo: "/articles",
    }
  }

  // 2. Unread article → continue reading.
  if (unread) {
    return {
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

  // 3. Large weak backlog → generate a targeted article.
  const weakCount = summary?.weak ?? 0
  if (weakCount >= 20) {
    return {
      tone: "generate",
      icon: SparklesIcon,
      eyebrow: "薄弱词累积中",
      headline: `有 ${weakCount} 个薄弱词等着被练上`,
      description:
        "生成一篇覆盖 30 个左右薄弱词的文章，用阅读一次把它们复习过去。",
      primaryLabel: "生成一篇",
      primaryTo: "/articles/new",
      secondaryLabel: "去薄弱词挑选",
      secondaryTo: "/vocab/weak",
    }
  }

  // 4. Hit daily target → surface history / review.
  const practiced = progress?.practiced ?? 0
  const target = progress?.target ?? 0
  if (target > 0 && practiced >= target) {
    return {
      tone: "done",
      icon: CheckmarkCircle02Icon,
      eyebrow: "今日目标已完成",
      headline: "太稳了。要不要回顾一下历史？",
      description: `今天已经背了 ${practiced} / ${target} 个词。可以重读前几篇文章，或者去看薄弱词里还剩哪些硬骨头。`,
      primaryLabel: "查看文章历史",
      primaryTo: "/articles",
      secondaryLabel: "盘点薄弱词",
      secondaryTo: "/vocab/weak",
    }
  }

  // 5. Default: nudge to generate something.
  return {
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

export function NextAction({ summary, progress, unreadArticle, isLoading }: NextActionProps) {
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

  const plan = computePlan(summary, progress, unreadArticle)
  const tone = toneStyles[plan.tone]
  const isDark = plan.tone === "primary"

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl p-6 sm:p-8",
        tone.card,
      )}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-2xl",
              tone.icon,
            )}
          >
            <HugeiconsIcon icon={plan.icon} size={20} strokeWidth={1.8} />
          </div>
          <div className="min-w-0 space-y-2">
            <div
              className={cn(
                "text-[10px] font-medium tracking-[0.2em] uppercase",
                tone.eyebrow,
              )}
            >
              {plan.eyebrow}
            </div>
            <h2
              className={cn(
                "font-heading text-xl leading-tight font-semibold tracking-tight sm:text-2xl",
                isDark ? "text-background" : "text-foreground",
              )}
            >
              {plan.headline}
            </h2>
            <p
              className={cn(
                "max-w-xl text-sm leading-relaxed",
                isDark ? "text-background/80" : "text-muted-foreground",
              )}
            >
              {plan.description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
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
          {plan.secondaryLabel && plan.secondaryTo && (
            <Button
              asChild
              size="default"
              variant={isDark ? "ghost" : "outline"}
              className={
                isDark
                  ? "text-background hover:bg-background/15 hover:text-background"
                  : undefined
              }
            >
              <Link to={plan.secondaryTo}>{plan.secondaryLabel}</Link>
            </Button>
          )}
          {plan.tone === "sync" && (
            <p className="w-full text-[11px] text-muted-foreground">
              MVP 阶段同步通过 env Token 触发，真实按钮稍后接入。
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
