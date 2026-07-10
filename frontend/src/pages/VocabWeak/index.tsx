import {
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"
import {
  useInfiniteQuery,
} from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { FilterToolbar } from "@/components/common/FilterToolbar"
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
import { useMediaQuery } from "@/hooks/use-media-query"
import { useSelectionSet } from "@/hooks/use-selection-set"
import { useSortState } from "@/hooks/use-sort-state"
import type { VocabSort } from "@/lib/api"
import type { ResponseFilter } from "@/lib/last-response"
import { MAX_TARGET_WORD_COUNT } from "@/lib/article-generation"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { withSim } from "@/lib/query-sim"
import type { VocabWord } from "@/types/api"

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
const PAGE_SIZE = 50

function sortParam(sortBy: SortBy, sortDir: "asc" | "desc"): VocabSort | undefined {
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

  const sort = sortParam(sortBy, sortDir)
  const weakKeyParams = {
    pageSize: PAGE_SIZE,
    lastResponse: responseFilter,
    tag: stickingOnly ? "STICKING" : undefined,
    sort,
    infinite: true as const,
  }

  const {
    data,
    isPending,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.vocab.weak(weakKeyParams),
    queryFn: async ({ pageParam = 1 }) =>
      withSim(
        () =>
          api.listWeakWordsPage({
            page: pageParam,
            pageSize: PAGE_SIZE,
            lastResponse: responseFilter,
            tag: stickingOnly ? "STICKING" : undefined,
            sort,
          }),
        {
          emptyValue: {
            items: [],
            total: 0,
            page: pageParam,
            page_size: PAGE_SIZE,
          },
        }
      )(),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const loaded = lastPage.page * lastPage.page_size
      return loaded < lastPage.total ? lastPage.page + 1 : undefined
    },
  })

  const loadedWords = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data]
  )
  const total = data?.pages[0]?.total ?? 0

  const { markMastered, ignoreWord } = useWordPreferences({
    onSettledWord: (word) => {
      selection.remove(word.id)
      setPendingAction(null)
    },
  })

  const visible = loadedWords
  const visibleIds = useMemo(() => visible.map((w) => w.id), [visible])

  const requestMaster = useCallback((word: VocabWord) => {
    setPendingAction({ type: "master", word })
  }, [])

  const requestIgnore = useCallback((word: VocabWord) => {
    setPendingAction({ type: "ignore", word })
  }, [])

  const handleGenerate = () => {
    if (selection.selectedCount === 0 || selection.selectedCount > MAX_SELECTION)
      return
    const ids = Array.from(selection.selected).join(",")
    navigate(`/articles/new?target_word_ids=${ids}`)
  }

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

  if (isPending) {
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

  if (total === 0) {
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
        description={`共 ${total} 个薄弱词 · 已加载 ${loadedWords.length} 个 · 勾选想练的词，一键生成定向文章`}
        aside="已掌握 / 忽略的词不再出现在这里"
      />

      <FilterToolbar>
        <ResponseFilterSelect
          value={responseFilter}
          onValueChange={setResponseFilter}
        />

        <Label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={stickingOnly}
            onCheckedChange={(v) => setStickingOnly(v === true)}
          />
          只看反复忘
        </Label>

        <div className="ms-auto flex items-center gap-1 text-xs text-muted-foreground">
          <span>
            显示已加载 {visible.length} · 已选 {selection.selectedCount}
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
          words={visible}
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
              onClick={() => toggleSort("weak_score")}
            />
          }
          studyHeader={
            <SortButton
              label="练习"
              active={sortBy === "study_count"}
              dir={sortDir}
              onClick={() => toggleSort("study_count")}
            />
          }
          extras={{
            trailCell: renderActions,
          }}
        />
      ) : (
        <VocabCardList
          words={visible}
          metric="weak"
          emptyLabel="没有匹配当前筛选的薄弱词。"
          selectedIds={selection.selected}
          onToggle={selection.toggleOne}
          renderActions={renderActions}
        />
      )}

      <div className="flex justify-center">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasNextPage || isFetchingNextPage}
          onClick={() => fetchNextPage()}
        >
          {isFetchingNextPage
            ? "加载中..."
            : hasNextPage
              ? "加载更多"
              : "已加载全部"}
        </Button>
      </div>

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
