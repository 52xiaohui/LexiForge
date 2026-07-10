import { Book02Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { useDeferredValue, useState } from "react"

import { FilterChip } from "@/components/common/FilterChip"
import { FilterToolbar } from "@/components/common/FilterToolbar"
import { ListSkeleton } from "@/components/common/ListSkeleton"
import { PageHeader } from "@/components/common/PageHeader"
import { ResponseFilterSelect } from "@/components/common/ResponseFilterSelect"
import { EmptyState, ErrorState } from "@/components/common/StatusPanel"
import {
  VocabCardList,
  VocabWordTable,
} from "@/components/vocab/VocabWordViews"
import { VocabPagination } from "@/components/vocab/VocabPagination"
import { Input } from "@/components/ui/input"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useVocabSummary } from "@/hooks/use-vocab-summary"
import type { ResponseFilter } from "@/lib/last-response"
import type { MasteryTierId } from "@/lib/mastery"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { withSim } from "@/lib/query-sim"

type MasteryFilter = "ALL" | MasteryTierId

const PAGE_SIZE = 50

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
  const deferredSearch = useDeferredValue(search)
  const isDesktop = useMediaQuery("(min-width: 768px)")

  const {
    data: summary,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useVocabSummary()

  const listParams = {
    page,
    pageSize: PAGE_SIZE,
    search: deferredSearch,
    lastResponse: responseFilter,
    masteryTier: masteryFilter,
    sort: "-mastery_score" as const,
  }

  const {
    data: pageData,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.vocab.words(listParams),
    queryFn: withSim(
      () => api.listWordsPage(listParams),
      { emptyValue: { items: [], total: 0, page, page_size: PAGE_SIZE } }
    ),
  })

  const pageItems = pageData?.items ?? []
  const total = pageData?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const tierCounts = summary?.by_mastery_tier ?? {
    mastered: 0,
    learning: 0,
    starting: 0,
  }
  const totalWords = summary?.total ?? total
  const [trackedPageCount, setTrackedPageCount] = useState(pageCount)
  if (trackedPageCount !== pageCount) {
    setTrackedPageCount(pageCount)
    if (page > pageCount) setPage(pageCount)
  }

  const resetPage = () => setPage(1)

  if (isPending) {
    return <ListSkeleton header="vocab" />
  }

  if (isError || isSummaryError) {
    return (
      <ErrorState
        description="没能加载词库。请稍后重试。"
        onRetry={() => {
          refetch()
          refetchSummary()
        }}
      />
    )
  }

  if (totalWords === 0) {
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
      <PageHeader description={`共 ${totalWords} 个词 · 你的词库总览与掌握进度`} />

      <div className="flex flex-wrap gap-2">
        {MASTERY_CHIPS.map((chip) => {
          const count = chip.id === "ALL" ? totalWords : tierCounts[chip.id]
          const active = masteryFilter === chip.id
          return (
            <FilterChip
              key={chip.id}
              active={active}
              onClick={() => {
                setMasteryFilter(chip.id)
                resetPage()
              }}
            >
              <span>{chip.label}</span>
              <span className="font-heading tabular-nums">{count}</span>
            </FilterChip>
          )
        })}
      </div>

      <FilterToolbar>
        <div className="relative min-w-56 flex-1">
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
        <ResponseFilterSelect
          value={responseFilter}
          onValueChange={(v) => {
            setResponseFilter(v)
            resetPage()
          }}
        />
      </FilterToolbar>

      {isDesktop ? (
        <VocabWordTable words={pageItems} metric="mastery" />
      ) : (
        <VocabCardList words={pageItems} metric="mastery" />
      )}

      <VocabPagination
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  )
}
