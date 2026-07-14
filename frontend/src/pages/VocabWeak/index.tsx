import {
  CheckmarkCircle02Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

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
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useListPage } from "@/hooks/use-list-page"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useSelectionSet } from "@/hooks/use-selection-set"
import { useSortState } from "@/hooks/use-sort-state"
import type { VocabSort } from "@/lib/api"
import type { ResponseFilter } from "@/lib/last-response"
import { MAX_TARGET_WORD_COUNT } from "@/lib/article-generation"
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { withSim } from "@/lib/query-sim"
import type { Page, VocabWord } from "@/types/api"

import { RowActions } from "./components/RowActions"
import { SelectionBar } from "./components/SelectionBar"
import { SortButton } from "./components/SortButton"
import {
  WeakActionDialog,
  type WeakPendingAction,
} from "./components/WeakActionDialog"
import { useWordPreferences } from "./hooks/use-word-preferences"

type SortBy = "weak_score" | "study_count"

const MAX_SELECTION = MAX_TARGET_WORD_COUNT
const PAGE_SIZE = DEFAULT_PAGE_SIZE
/** One-click “this round” package size for generation. */
const RECOMMEND_COUNT = 20

function sortParam(
  sortBy: SortBy,
  sortDir: "asc" | "desc"
): VocabSort | undefined {
  if (sortBy === "weak_score") {
    return sortDir === "desc" ? "-weak_score" : "weak_score"
  }
  if (sortBy === "study_count") {
    return sortDir === "desc" ? "-study_count" : "study_count"
  }
  return undefined
}

export function VocabWeak() {
  const navigate = useNavigate()
  const [responseFilter, setResponseFilter] = useState<ResponseFilter>("ALL")
  const [stickingOnly, setStickingOnly] = useState(false)
  const { sortBy, sortDir, toggleSort } = useSortState<SortBy>("weak_score")
  const selection = useSelectionSet()
  const [pendingAction, setPendingAction] = useState<WeakPendingAction | null>(
    null
  )
  const isDesktop = useMediaQuery("(min-width: 768px)")

  const [totalHint, setTotalHint] = useState(0)
  const { page, pageCount, setPage, reset } = useListPage(totalHint, PAGE_SIZE)

  const sort = sortParam(sortBy, sortDir)
  const listParams = {
    page,
    pageSize: PAGE_SIZE,
    lastResponse: responseFilter,
    tag: stickingOnly ? "STICKING" : undefined,
    sort,
  }

  const {
    data: pageData,
    isPending,
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.vocab.weak(listParams),
    queryFn: withSim<Page<VocabWord>>(
      () => api.listWeakWordsPage(listParams),
      {
        emptyValue: {
          items: [],
          total: 0,
          page,
          page_size: PAGE_SIZE,
        },
      }
    ),
    placeholderData: (previousData) => previousData,
  })

  const pageItems = useMemo(
    () => pageData?.items ?? [],
    [pageData?.items]
  )
  const total = pageData?.total ?? 0
  if (totalHint !== total) {
    setTotalHint(total)
  }

  const { markMastered, ignoreWord } = useWordPreferences({
    onSettledWord: (word) => {
      selection.remove(word.id)
      setPendingAction(null)
    },
  })

  const visibleIds = useMemo(() => pageItems.map((w) => w.id), [pageItems])

  const requestMaster = useCallback((word: VocabWord) => {
    setPendingAction({ type: "master", word })
  }, [])

  const requestIgnore = useCallback((word: VocabWord) => {
    setPendingAction({ type: "ignore", word })
  }, [])

  const handleGenerate = () => {
    if (
      selection.selectedCount === 0 ||
      selection.selectedCount > MAX_SELECTION
    )
      return
    const ids = Array.from(selection.selected).join(",")
    navigate(`/articles/new?target_word_ids=${ids}`)
  }

  const [recommendBusy, setRecommendBusy] = useState(false)
  const handleRecommendGenerate = async () => {
    if (recommendBusy) return
    setRecommendBusy(true)
    try {
      const page = await api.listWeakWordsPage({
        page: 1,
        pageSize: RECOMMEND_COUNT,
        lastResponse: responseFilter,
        tag: stickingOnly ? "STICKING" : undefined,
        sort: sort ?? "-weak_score",
      })
      if (page.items.length === 0) {
        toast("没有可推荐的薄弱词", {
          description: "试试放宽筛选，或先同步墨墨。",
        })
        return
      }
      const ids = page.items.map((w) => w.id).join(",")
      navigate(`/articles/new?target_word_ids=${ids}`)
    } catch (error) {
      toast.error("推荐失败", {
        description:
          error instanceof Error ? error.message : "请稍后再试。",
      })
    } finally {
      setRecommendBusy(false)
    }
  }

  const handleSort = useCallback(
    (column: SortBy) => {
      toggleSort(column)
      reset()
    },
    [toggleSort, reset]
  )

  const renderActions = useCallback(
    (word: VocabWord) => (
      <RowActions
        spelling={word.spelling}
        onMaster={() => requestMaster(word)}
        onIgnore={() => requestIgnore(word)}
      />
    ),
    [requestMaster, requestIgnore]
  )

  if (isPending && !pageData) {
    return <ListSkeleton header="weak" selectable />
  }

  if (isError) {
    return (
      <ErrorState
        description="没能加载薄弱词。请稍后重试。"
        onRetry={() => refetch()}
      />
    )
  }

  if (total === 0 && responseFilter === "ALL" && !stickingOnly) {
    return (
      <EmptyState
        icon={CheckmarkCircle02Icon}
        title="暂无薄弱词"
        description="已掌握和忽略的词不会出现在这里。下次同步后，新的薄弱词会出现。"
      />
    )
  }

  return (
    <div className="space-y-6 pb-24 md:pb-20">
      <PageHeader
        description={`共 ${total} 个薄弱词 · 勾选想练的词，或一键推荐 ${RECOMMEND_COUNT} 个`}
        aside="已掌握 / 忽略的词不再出现在这里"
        action={
          <Button
            size="sm"
            disabled={recommendBusy || total === 0}
            onClick={() => void handleRecommendGenerate()}
          >
            <HugeiconsIcon
              icon={SparklesIcon}
              data-icon="inline-start"
              strokeWidth={1.8}
              className={recommendBusy ? "animate-pulse" : undefined}
            />
            {recommendBusy ? "准备中…" : `推荐 ${RECOMMEND_COUNT} 词生成`}
          </Button>
        }
      />

      <FilterToolbar>
        <ResponseFilterSelect
          value={responseFilter}
          onValueChange={(v) => {
            setResponseFilter(v)
            reset()
          }}
        />

        <Label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={stickingOnly}
            onCheckedChange={(v) => {
              setStickingOnly(v === true)
              reset()
            }}
          />
          只看反复忘
        </Label>

        <div className="ms-auto flex items-center gap-1 text-xs text-muted-foreground">
          <span>
            本页 {pageItems.length}
            {selection.selectedCount > 0 && (
              <>
                {" "}
                · 已选{" "}
                <strong className="tabular-nums text-foreground">
                  {selection.selectedCount}
                </strong>
              </>
            )}
          </span>
          {selection.selectedCount > 0 && (
            <Button variant="ghost" size="xs" onClick={selection.clear}>
              清空
            </Button>
          )}
        </div>
      </FilterToolbar>

      {isDesktop ? (
        <VocabWordTable
          words={pageItems}
          metric="weak"
          emptyLabel="没有匹配当前筛选的薄弱词。"
          selectedIds={selection.selected}
          onToggle={selection.toggleOne}
          onToggleAllVisible={(next) => selection.toggleMany(visibleIds, next)}
          metricHeader={
            <SortButton
              label="weak"
              active={sortBy === "weak_score"}
              dir={sortDir}
              onClick={() => handleSort("weak_score")}
            />
          }
          studyHeader={
            <SortButton
              label="练习"
              active={sortBy === "study_count"}
              dir={sortDir}
              onClick={() => handleSort("study_count")}
            />
          }
          extras={{
            trailCell: renderActions,
          }}
        />
      ) : (
        <VocabCardList
          words={pageItems}
          metric="weak"
          emptyLabel="没有匹配当前筛选的薄弱词。"
          selectedIds={selection.selected}
          onToggle={selection.toggleOne}
          renderActions={renderActions}
        />
      )}

      <ListPagination
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        isFetching={isFetching && !isPending}
        aside={
          selection.selectedCount > 0 ? (
            <span className="text-muted-foreground">
              已选{" "}
              <strong className="tabular-nums text-foreground">
                {selection.selectedCount}
              </strong>
              （可跨页勾选）
            </span>
          ) : null
        }
      />

      <WeakActionDialog
        action={pendingAction}
        onOpenChange={(open) => !open && setPendingAction(null)}
        onConfirm={() => {
          if (!pendingAction) return
          if (pendingAction.type === "master") {
            markMastered.mutate(pendingAction.word)
          } else {
            ignoreWord.mutate(pendingAction.word)
          }
        }}
      />

      <SelectionBar
        selectedCount={selection.selectedCount}
        maxSelection={MAX_SELECTION}
        onClear={selection.clear}
        onGenerate={handleGenerate}
      />
    </div>
  )
}
