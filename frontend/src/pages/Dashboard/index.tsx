import type { ReactNode } from "react"

import {
  Activity03Icon,
  AlertCircleIcon,
  ArrowRight01Icon,
  Book02Icon,
  Calendar03Icon,
  CloudDownloadIcon,
  DashboardCircleIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"

import { StatCard } from "@/components/common/StatCard"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  formatAbsoluteTime,
  formatCount,
  formatRelativeTime,
} from "@/lib/formatters"
import { mockStore } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

import { NextAction } from "./components/NextAction"
import { NextReview } from "./components/NextReview"
import { RecentArticles } from "./components/RecentArticles"

const weekdayFormatter = new Intl.DateTimeFormat("zh-CN", { weekday: "long" })

export function Dashboard() {
  const { data: summary, isPending: isSummaryPending } = useQuery({
    queryKey: ["vocab", "summary"],
    queryFn: async () => mockStore.vocabSummary(),
  })
  const { data: progress } = useQuery({
    queryKey: ["progress", "today"],
    queryFn: async () => mockStore.todayProgress(),
  })
  const { data: articles } = useQuery({
    queryKey: ["articles", "recent"],
    queryFn: async () => mockStore.listRecentArticles(),
  })
  const { data: nextReview } = useQuery({
    queryKey: ["vocab", "next-review"],
    queryFn: async () => mockStore.nextReview(),
  })
  const { data: unreadArticle } = useQuery({
    queryKey: ["articles", "first-unread"],
    queryFn: async () => mockStore.firstUnreadArticle(),
  })

  const total = summary?.total ?? 0
  const weak = summary?.weak ?? 0
  const weakPct = total > 0 ? Math.round((weak / total) * 100) : 0
  const practiced = progress?.practiced ?? 0
  const target = progress?.target ?? 0
  const progressPct = target > 0 ? Math.round((practiced / target) * 100) : 0
  const lastSync = summary?.last_synced_at ?? null
  const streakDays = progress?.streak_days ?? 0

  // First-run state: no vocab yet means the backend hasn't seen a sync. We
  // surface a dedicated onboarding card and hide the zero-filled StatCards to
  // avoid making the app look broken.
  const isFirstRun = summary != null && total === 0 && weak === 0

  return (
    <div className="space-y-8 sm:space-y-10">
      {isFirstRun ? (
        <FirstRunCard />
      ) : (
        <>
          <section className="space-y-4">
            <div className="flex items-end justify-between">
              <p className="text-sm tracking-wide text-muted-foreground">
                {weekdayFormatter.format(new Date())} · 下一步
              </p>
            </div>
            <NextAction
              summary={summary}
              progress={progress}
              unreadArticle={unreadArticle ?? null}
              isLoading={isSummaryPending}
            />
          </section>

          {/* Phones: a single consolidated summary strip instead of four
              separate ring'd StatCards, so 总览 doesn't open with a wall of
              boxes. The full StatCard grid returns from `sm` up. */}
          <MobileStatStrip
            total={formatCount(total)}
            weak={formatCount(weak)}
            weakPct={weakPct}
            practiced={practiced}
            target={target}
            progressPct={progressPct}
            streakDays={streakDays}
            lastSync={lastSync}
          />

          <section className="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="总单词数"
              value={formatCount(total)}
              hint="同步自墨墨学习记录"
              icon={Book02Icon}
              tone="accent"
              trend={summary?.total_trend}
            />
            <StatCard
              label="薄弱词数量"
              value={formatCount(weak)}
              hint={`占总词量 ${weakPct}%`}
              icon={AlertCircleIcon}
              tone="warning"
              trend={summary?.weak_trend}
            />
            <StatCard
              label="今日进度"
              value={
                <span>
                  {practiced}
                  <span className="text-base font-normal text-muted-foreground">
                    {" "}
                    / {target}
                  </span>
                </span>
              }
              hint={
                target > 0
                  ? streakDays > 0
                    ? `已练 ${progressPct}% · 连续 ${streakDays} 天`
                    : `已练 ${progressPct}%`
                  : streakDays > 0
                    ? `今天还没有目标 · 连续 ${streakDays} 天`
                    : "今天还没有目标"
              }
              icon={Activity03Icon}
              footer={<Progress value={progressPct} className="h-1.5" />}
            />
            <StatCard
              label="最近同步"
              value={formatRelativeTime(lastSync)}
              hint={lastSync ? formatAbsoluteTime(lastSync) : "尚未同步"}
              icon={Calendar03Icon}
            />
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <RecentArticles articles={articles ?? []} />
            </div>
            <div className="lg:col-span-2">
              <NextReview words={nextReview ?? []} />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

/**
 * Empty-state card shown when the user has no vocab at all. Replaces the
 * zero-filled StatCard row so the first screen explains how to make the
 * product useful instead of showing "0 / 0 / 0".
 */
function FirstRunCard() {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-card p-8 text-center ring-1 ring-foreground/5 sm:p-12">
        <div className="mx-auto mb-6 grid size-14 place-items-center rounded-3xl bg-foreground text-background">
          <HugeiconsIcon icon={DashboardCircleIcon} size={22} strokeWidth={1.6} />
        </div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          欢迎使用 LexiForge
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          LexiForge 会从你的墨墨学习数据里挑出最薄弱的词，写一段带语境的英文短文，
          帮你把零散的单词卡片串成可读的内容。
        </p>
        <div className="mx-auto mt-8 grid max-w-xl gap-3 text-left sm:grid-cols-3">
          <StepCard
            step="1"
            title="同步墨墨"
            desc="MVP 阶段通过环境变量 MAIMEMO_TOKEN 触发后端同步。"
            icon={CloudDownloadIcon}
          />
          <StepCard
            step="2"
            title="挑选薄弱词"
            desc="按 last_response、STICKING 和 weak_score 过滤，也可以手动勾选。"
            icon={AlertCircleIcon}
          />
          <StepCard
            step="3"
            title="生成文章"
            desc="选主题、难度、长度，AI 帮你写一段覆盖目标词的短文。"
            icon={SparklesIcon}
          />
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/vocab/weak">
              去看薄弱词
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                data-icon="inline-end"
                strokeWidth={1.8}
              />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/articles/new">直接生成一篇</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

interface StepCardProps {
  step: string
  title: string
  desc: string
  icon: typeof DashboardCircleIcon
}

function StepCard({ step, title, desc, icon }: StepCardProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <div className="grid size-6 place-items-center rounded-lg bg-foreground text-[10px] font-semibold text-background tabular-nums">
          {step}
        </div>
        <HugeiconsIcon icon={icon} size={14} strokeWidth={1.8} />
      </div>
      <div className="mt-2 font-heading text-sm font-medium">{title}</div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  )
}

interface MobileStatStripProps {
  total: string
  weak: string
  weakPct: number
  practiced: number
  target: number
  progressPct: number
  streakDays: number
  lastSync: string | null
}

/**
 * Mobile-only condensed equivalent of the four StatCards. One bordered
 * container split into a 2×2 grid by hairline dividers — keeps the same four
 * numbers but as a single visual unit instead of four stacked ring'd boxes.
 */
function MobileStatStrip({
  total,
  weak,
  weakPct,
  practiced,
  target,
  progressPct,
  streakDays,
  lastSync,
}: MobileStatStripProps) {
  return (
    <section className="sm:hidden">
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl ring-1 ring-foreground/10">
        <StatCell
          className="border-r border-b border-border/60"
          label="总词数"
          value={total}
          hint="同步自墨墨"
        />
        <StatCell
          className="border-b border-border/60"
          label="薄弱词"
          value={weak}
          hint={`占 ${weakPct}%`}
        />
        <StatCell
          className="border-r border-border/60"
          label="今日进度"
          value={
            <span>
              {practiced}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}
                / {target}
              </span>
            </span>
          }
          hint={
            target > 0
              ? streakDays > 0
                ? `已练 ${progressPct}% · 连续 ${streakDays} 天`
                : `已练 ${progressPct}%`
              : streakDays > 0
                ? `连续 ${streakDays} 天`
                : "暂无目标"
          }
        />
        <StatCell
          label="最近同步"
          value={
            <span className="text-xl">{formatRelativeTime(lastSync)}</span>
          }
          hint={lastSync ? "已是最新数据来源" : "尚未同步"}
        />
      </div>
    </section>
  )
}

interface StatCellProps {
  label: string
  value: ReactNode
  hint?: string
  className?: string
}

function StatCell({ label, value, hint, className }: StatCellProps) {
  return (
    <div className={cn("bg-card p-3.5", className)}>
      <div className="text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1 font-heading text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {hint}
        </div>
      )}
    </div>
  )
}
