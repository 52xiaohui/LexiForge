import {
  Activity03Icon,
  AlertCircleIcon,
  Book02Icon,
  Calendar03Icon,
} from "@hugeicons/core-free-icons"
import { useQuery } from "@tanstack/react-query"

import { StatCard } from "@/components/common/StatCard"
import { Progress } from "@/components/ui/progress"
import {
  formatAbsoluteTime,
  formatCount,
  formatRelativeTime,
} from "@/lib/formatters"
import { mockStore } from "@/lib/mock-data"

import { NextAction } from "./components/NextAction"
import { NextReview } from "./components/NextReview"
import { RecentArticles } from "./components/RecentArticles"

const weekdayFormatter = new Intl.DateTimeFormat("zh-CN", { weekday: "long" })

export function Dashboard() {
  const { data: summary } = useQuery({
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

  return (
    <div className="space-y-10">
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
        />
      </section>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="总单词数"
          value={formatCount(total)}
          hint="同步自墨墨学习记录"
          icon={Book02Icon}
          tone="accent"
        />
        <StatCard
          label="薄弱词数量"
          value={formatCount(weak)}
          hint={`占总词量 ${weakPct}%`}
          icon={AlertCircleIcon}
          tone="warning"
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
          hint={`已练 ${progressPct}%`}
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
    </div>
  )
}
