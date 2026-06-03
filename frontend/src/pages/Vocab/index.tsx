import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Book02Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { LastResponseBadge } from "@/components/common/LastResponseBadge"
import { MasteryMeter } from "@/components/common/MasteryMeter"
import { EmptyState, ErrorState } from "@/components/common/StatusPanel"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateShort } from "@/lib/formatters"
import { masteryTierFor, type MasteryTierId } from "@/lib/mastery"
import { mockStore } from "@/lib/mock-data"
import { withSim } from "@/lib/query-sim"
import { cn } from "@/lib/utils"
import type { LastResponse, VocabWord } from "@/types/api"

type ResponseFilter = "ALL" | LastResponse
type MasteryFilter = "ALL" | MasteryTierId

const PAGE_SIZE = 15

const MASTERY_CHIPS: { id: MasteryFilter; label: string }[] = [
  { id: "ALL", label: "全部" },
  { id: "mastered", label: "已掌握" },
  { id: "learning", label: "巩固中" },
  { id: "starting", label: "起步" },
]

export function Vocab() {
  const [search, setSearch] = useState("")
  const [responseFilter, setResponseFilter] = useState<ResponseFilter>("ALL")
  const [masteryFilter, setMasteryFilter] = useState<MasteryFilter>("ALL")
  const [page, setPage] = useState(1)

  const { data = [], isPending, isError, refetch } = useQuery({
    queryKey: ["vocab", "words"],
    queryFn: withSim(async () => mockStore.listWords(), { emptyValue: [] }),
  })

  // Distribution by mastery tier across the whole library — gives the page its
  // "overview" identity (薄弱词 has no such breakdown) and powers the chips.
  const tierCounts = useMemo(() => {
    const counts = { mastered: 0, learning: 0, starting: 0 }
    for (const w of data) counts[masteryTierFor(w.mastery_score)] += 1
    return counts
  }, [data])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return data
      .filter((w) => {
        if (responseFilter !== "ALL" && w.last_response !== responseFilter) {
          return false
        }
        if (
          masteryFilter !== "ALL" &&
          masteryTierFor(w.mastery_score) !== masteryFilter
        ) {
          return false
        }
        if (!query) return true
        return (
          w.spelling.toLowerCase().includes(query) ||
          w.translation.toLowerCase().includes(query)
        )
      })
      // Lead with the most-mastered words: 全部单词 reads as a progress overview,
      // distinct from 薄弱词 which surfaces the weakest first.
      .sort((a, b) => b.mastery_score - a.mastery_score || b.weak_score - a.weak_score)
  }, [data, search, responseFilter, masteryFilter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  // Clamp `page` into range when filters shrink the list. Adjusting state
  // during render (rather than in an effect) is React's recommended pattern
  // for state that's fully derived from other state.
  if (page > pageCount) {
    setPage(pageCount)
  }

  const resetPage = () => setPage(1)

  if (isPending) {
    return <VocabSkeleton />
  }

  if (isError) {
    return (
      <ErrorState
        description="没能加载词库。请稍后重试。"
        onRetry={() => refetch()}
      />
    )
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={Book02Icon}
        title="词库还是空的"
        description="同步你的墨墨学习记录后，单词会出现在这里。"
      />
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        共 {data.length} 个词 · 你的词库总览与掌握进度
      </p>

      <div className="flex flex-wrap gap-2">
        {MASTERY_CHIPS.map((chip) => {
          const count =
            chip.id === "ALL"
              ? data.length
              : tierCounts[chip.id]
          const active = masteryFilter === chip.id
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => {
                setMasteryFilter(chip.id)
                resetPage()
              }}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                active
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border/60 text-muted-foreground hover:bg-muted/50",
              )}
            >
              <span>{chip.label}</span>
              <span className="font-heading tabular-nums">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-muted/30 p-3">
        <div className="relative flex-1 min-w-56">
          <HugeiconsIcon
            icon={Search01Icon}
            size={14}
            strokeWidth={1.8}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="搜索单词或释义"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              resetPage()
            }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">反馈</Label>
          <Select
            value={responseFilter}
            onValueChange={(v: ResponseFilter) => {
              setResponseFilter(v)
              resetPage()
            }}
          >
            <SelectTrigger size="sm" className="min-w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部</SelectItem>
              <SelectItem value="FORGET">遗忘</SelectItem>
              <SelectItem value="VAGUE">模糊</SelectItem>
              <SelectItem value="FAMILIAR">熟悉</SelectItem>
              <SelectItem value="WELL_FAMILIAR">已掌握</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Desktop table. Below md we switch to a card list so the 7-column table
          never forces horizontal scroll on phones. */}
      <div className="hidden overflow-hidden rounded-2xl border border-border/60 md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="pl-4">单词</TableHead>
              <TableHead>释义</TableHead>
              <TableHead>反馈</TableHead>
              <TableHead>掌握度</TableHead>
              <TableHead>练习次数</TableHead>
              <TableHead>标签</TableHead>
              <TableHead className="pr-4 text-right">下次复习</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-16 text-center text-sm text-muted-foreground"
                >
                  没有匹配的单词。
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((word) => (
                <TableRow key={word.id}>
                  <TableCell className="pl-4">
                    <div className="font-heading text-sm font-medium">{word.spelling}</div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {word.translation}
                  </TableCell>
                  <TableCell>
                    <LastResponseBadge value={word.last_response} />
                  </TableCell>
                  <TableCell>
                    <MasteryMeter score={word.mastery_score} />
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {word.study_count}
                  </TableCell>
                  <TableCell>
                    {word.tags.includes("STICKING") && (
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        反复忘
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 text-right text-xs tabular-nums text-muted-foreground">
                    {formatDateShort(word.next_study_date)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden">
        {pageItems.length === 0 ? (
          <div className="rounded-2xl border border-border/60 py-16 text-center text-sm text-muted-foreground">
            没有匹配的单词。
          </div>
        ) : (
          <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60">
            {pageItems.map((word) => (
              <WordCard key={word.id} word={word} />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          第 {safePage} / {pageCount} 页 · 共 {filtered.length} 个词
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="上一页"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={1.8} />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="下一页"
            disabled={safePage >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={1.8} />
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Mobile card equivalent of a table row. Read-only (全部单词 is a browse view,
 * unlike 薄弱词's selectable cards), tuned for narrow screens with no
 * horizontal scroll.
 */
function WordCard({ word }: { word: VocabWord }) {
  return (
    <div className="bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-heading text-base font-medium tracking-tight">
          {word.spelling}
        </div>
        <div className="flex items-baseline gap-1.5 text-xs text-muted-foreground tabular-nums">
          <MasteryMeter score={word.mastery_score} variant="compact" />
          <span>掌握</span>
        </div>
      </div>
      <div className="mt-1 truncate text-sm text-muted-foreground">
        {word.translation}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <LastResponseBadge value={word.last_response} />
        {word.tags.includes("STICKING") && (
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            反复忘
          </Badge>
        )}
        <span className="text-muted-foreground">练习 {word.study_count} 次</span>
        {word.next_study_date && (
          <>
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            <span className="text-muted-foreground">
              下次 {formatDateShort(word.next_study_date)}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

function VocabSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-56" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-14 w-full rounded-2xl" />
      <div className="space-y-2 rounded-2xl border border-border/60 p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
