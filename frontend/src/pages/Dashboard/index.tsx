import {
  AlertCircleIcon,
  CloudDownloadIcon,
  DashboardCircleIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { useMaimemoSync } from "@/hooks/use-maimemo-sync"
import { useVocabSummary } from "@/hooks/use-vocab-summary"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

import { HealthStrip } from "./components/HealthStrip"
import { NextAction } from "./components/NextAction"
import { NextReview } from "./components/NextReview"
import { RecentArticles } from "./components/RecentArticles"

export function Dashboard() {
  const { data: summary, isPending: isSummaryPending } = useVocabSummary()
  const { data: articles, isPending: isArticlesPending } = useQuery({
    queryKey: queryKeys.articles.recent(),
    queryFn: () => api.listRecentArticles(),
  })
  const { data: nextReview, isPending: isReviewPending } = useQuery({
    queryKey: queryKeys.vocab.nextReview(),
    queryFn: () => api.nextReview(),
  })
  const { data: unreadArticle } = useQuery({
    queryKey: queryKeys.articles.firstUnread(),
    queryFn: () => api.firstUnreadArticle(),
  })

  const { sync, isSyncing, cooldownRemaining } = useMaimemoSync()

  const total = summary?.total ?? 0
  const weak = summary?.weak ?? 0
  const lastSync = summary?.last_synced_at ?? null
  const stickingCount = summary?.sticking_count ?? 0

  // First-run state: no vocab yet means the backend hasn't seen a sync.
  const isFirstRun = summary != null && total === 0 && weak === 0

  return (
    <div className="space-y-6 sm:space-y-8">
      {isFirstRun ? (
        <FirstRunCard
          isSyncing={isSyncing}
          syncCooldownRemaining={cooldownRemaining}
          onSync={sync}
        />
      ) : (
        <>
          <HealthStrip
            total={total}
            weak={weak}
            stickingCount={stickingCount}
            lastSync={lastSync}
            isLoading={isSummaryPending && summary === undefined}
            isSyncing={isSyncing}
            syncCooldownRemaining={cooldownRemaining}
            onSync={sync}
          />

          <section className="space-y-3">
            <p className="text-sm text-muted-foreground">下一步</p>
            <NextAction
              summary={summary}
              unreadArticle={unreadArticle ?? null}
              isLoading={isSummaryPending}
              isSyncing={isSyncing}
              syncCooldownRemaining={cooldownRemaining}
              onSync={sync}
            />
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <RecentArticles
                articles={articles ?? []}
                isLoading={isArticlesPending && articles === undefined}
              />
            </div>
            <div className="lg:col-span-2">
              <NextReview
                words={nextReview ?? []}
                isLoading={isReviewPending && nextReview === undefined}
              />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function FirstRunCard({
  isSyncing,
  syncCooldownRemaining,
  onSync,
}: {
  isSyncing: boolean
  syncCooldownRemaining: number
  onSync: () => void
}) {
  const syncDisabled = isSyncing || syncCooldownRemaining > 0

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-card p-8 text-center ring-1 ring-foreground/5 sm:p-12">
        <div className="mx-auto mb-6 grid size-14 place-items-center rounded-3xl bg-foreground text-background">
          <HugeiconsIcon
            icon={DashboardCircleIcon}
            size={22}
            strokeWidth={1.6}
          />
        </div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">
          欢迎使用 LexiForge
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          LexiForge
          会从你的墨墨学习数据里挑出最薄弱的词，写一段带语境的英文短文，
          帮你把零散的单词卡片串成可读的内容。
        </p>
        <div className="mx-auto mt-8 grid max-w-xl gap-3 text-left sm:grid-cols-3">
          <StepCard
            step="1"
            title="同步墨墨"
            desc="后端通过 MAIMEMO_TOKEN 拉取学习记录。先同步，后面的推荐才有依据。"
            icon={CloudDownloadIcon}
          />
          <StepCard
            step="2"
            title="挑选薄弱词"
            desc="按反馈、反复忘和 weak_score 过滤，也可以手动勾选。"
            icon={AlertCircleIcon}
          />
          <StepCard
            step="3"
            title="生成文章"
            desc="选主题、难度、长度，AI 写一段覆盖目标词的短文。"
            icon={SparklesIcon}
          />
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Button
            size="default"
            disabled={syncDisabled}
            onClick={onSync}
          >
            <HugeiconsIcon
              icon={CloudDownloadIcon}
              data-icon="inline-start"
              strokeWidth={1.8}
              className={isSyncing ? "animate-spin" : undefined}
            />
            {isSyncing
              ? "同步中…"
              : syncCooldownRemaining > 0
                ? `${syncCooldownRemaining}s 后可同步`
                : "同步墨墨数据"}
          </Button>
          <Button asChild variant="outline">
            <Link to="/articles/new">直接生成一篇</Link>
          </Button>
        </div>
        <p className="mx-auto mt-4 max-w-sm text-xs text-muted-foreground">
          需在后端环境变量中配置{" "}
          <code className="rounded bg-muted px-1 py-0.5">MAIMEMO_TOKEN</code>
          。同步完成后，总览会显示真实词库数据。
        </p>
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
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {desc}
      </p>
    </div>
  )
}
