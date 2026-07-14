import { Book02Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { useDeferredValue, useState } from "react"

import { FilterChip } from "@/components/common/FilterChip"
import { FilterToolbar } from "@/components/common/FilterToolbar"
import { ListPagination } from "@/components/common/ListPagination"
import { ListSkeleton } from "@/components/common/ListSkeleton"
import { PageHeader } from "@/components/common/PageHeader"
import { ResponseFilterSelect } from "@/components/common/ResponseFilterSelect"
import { EmptyState, ErrorState } from "@/components/common/StatusPanel"
import {
  VocabCardList,
  VocabWordTable,
} from "@/components/vocab/VocabWordViews"
import { Input } from "@/components/ui/input"
import { useListPage } from "@/hooks/use-list-page"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useVocabSummary } from "@/hooks/use-vocab-summary"
import type { ResponseFilter } from "@/lib/last-response"
import type { MasteryTierId } from "@/lib/mastery"
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { withSim } from "@/lib/query-sim"
import type { Page, VocabWord } from "@/types/api"

type MasteryFilter = "ALL" | MasteryTierId

const PAGE_SIZE = DEFAULT_PAGE_SIZE

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
  const deferredSearch = useDeferredValue(search)
  const isDesktop = useMediaQuery("(min-width: 768px)")

  const {
    data: summary,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useVocabSummary()

  // Page is owned after we know total; seed with 0 total until first fetch.
  // useListPage clamps when total arrives/changes.
  const [totalHint, setTotalHint] = useState(0)
  const { page, pageCount, setPage, reset } = useListPage(totalHint, PAGE_SIZE)

  const listParams = {
    page,
    pageSize: PAGE_SIZE,
    search: deferredSearch,
    lastResponse: responseFilter,
    masteryTier: masteryFilter,
    // Lead with words that still need work (low mastery), not the already-owned set.
    sort: "mastery_score" as const,
  }

  const {
    data: pageData,
    isPending,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.vocab.words(listParams),
    queryFn: withSim<Page<VocabWord>>(
      () => api.listWordsPage(listParams),
      { emptyValue: { items: [], total: 0, page, page_size: PAGE_SIZE } }
    ),
    placeholderData: (previousData) => previousData,
  })

  const pageItems = pageData?.items ?? []
  const total = pageData?.total ?? 0
  if (totalHint !== total) {
    setTotalHint(total)
  }

  const tierCounts = summary?.by_mastery_tier ?? {
    mastered: 0,
    learning: 0,
    starting: 0,
  }
  const totalWords = summary?.total ?? total

  if (isPending && !pageData) {
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
                reset()
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
              reset()
            }}
            className="pl-9"
          />
        </div>
        <ResponseFilterSelect
          value={responseFilter}
          onValueChange={(v) => {
            setResponseFilter(v)
            reset()
          }}
        />
      </FilterToolbar>

      {isDesktop ? (
        <VocabWordTable words={pageItems} metric="mastery" />
      ) : (
        <VocabCardList words={pageItems} metric="mastery" />
      )}

      <ListPagination
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        isFetching={isFetching && !isPending}
      />
    </div>
  )
}
