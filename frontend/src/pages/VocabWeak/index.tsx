import {
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  CheckmarkCircle02Icon,
  MoreHorizontalIcon,
  SparklesIcon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { memo, useCallback, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { LastResponseBadge } from "@/components/common/LastResponseBadge"
import { EmptyState, ErrorState } from "@/components/common/StatusPanel"
import { WeakScoreMeter } from "@/components/common/WeakScoreMeter"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import { api } from "@/lib/api"
import type { VocabSort } from "@/lib/api"
import { withSim } from "@/lib/query-sim"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"
import type { LastResponse, VocabWord } from "@/types/api"

type ResponseFilter = "ALL" | LastResponse
type SortBy = "weak_score" | "study_count"
type SortDir = "asc" | "desc"

const MAX_SELECTION = 80
const PAGE_SIZE = 50

function sortParam(sortBy: SortBy, sortDir: SortDir): VocabSort | undefined {
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
  const queryClient = useQueryClient()
  const [responseFilter, setResponseFilter] = useState<ResponseFilter>("ALL")
  const [stickingOnly, setStickingOnly] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>("weak_score")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pendingAction, setPendingAction] = useState<{
    type: "master" | "ignore"
    word: VocabWord
  } | null>(null)
  const isDesktop = useMediaQuery("(min-width: 768px)")

  const {
    data,
    isPending,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [
      "vocab",
      "weak",
      PAGE_SIZE,
      responseFilter,
      stickingOnly,
      sortBy,
      sortDir,
    ],
    queryFn: async ({ pageParam = 1 }) =>
      withSim(
        () =>
          api.listWeakWordsPage({
            page: pageParam,
            pageSize: PAGE_SIZE,
            lastResponse: responseFilter,
            tag: stickingOnly ? "STICKING" : undefined,
            sort: sortParam(sortBy, sortDir),
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

  const removeFromSelection = useCallback((id: string) => {
    setSelected((prev) => {
      if (!prev.has(id)) return prev
      const copy = new Set(prev)
      copy.delete(id)
      return copy
    })
  }, [])

  const markMastered = useMutation({
    mutationFn: async (word: VocabWord) => {
      const wordId = word.word_id
      if (!wordId) throw new Error("缺少单词 ID，无法标记掌握")
      await api.markWordMastered(wordId, true)
      return word
    },
    meta: { silent: true },
    onSuccess: (word) => {
      removeFromSelection(word.id)
      setPendingAction(null)
      queryClient.invalidateQueries({ queryKey: ["vocab"] })
      toast("已标记为掌握", {
        description: `「${word.spelling}」从薄弱词中移除`,
        duration: 6000,
      })
    },
    onError: (error) => {
      toast.error("标记掌握失败", {
        description: error instanceof Error ? error.message : "请稍后再试。",
      })
    },
  })

  const ignoreWord = useMutation({
    mutationFn: async (word: VocabWord) => {
      await api.markWordIgnored(word.id, true)
      return word
    },
    meta: { silent: true },
    onSuccess: (word) => {
      removeFromSelection(word.id)
      setPendingAction(null)
      queryClient.invalidateQueries({ queryKey: ["vocab"] })
      toast("已忽略", {
        description: `「${word.spelling}」下次同步前不再出现`,
        duration: 6000,
        action: {
          label: "撤销",
          onClick: () => {
            void api.markWordIgnored(word.id, false).then(() => {
              queryClient.invalidateQueries({ queryKey: ["vocab"] })
            })
          },
        },
      })
    },
    onError: (error) => {
      toast.error("忽略失败", {
        description: error instanceof Error ? error.message : "请稍后再试。",
      })
    },
  })

  const visible = useMemo(() => {
    let rows = loadedWords.slice()
    return rows
  }, [loadedWords])

  const selectedCount = selected.size
  const overLimit = selectedCount > MAX_SELECTION
  const visibleIds = useMemo(() => visible.map((w) => w.id), [visible])
  const allVisibleSelected =
    visible.length > 0 && visibleIds.every((id) => selected.has(id))
  const someVisibleSelected =
    !allVisibleSelected && visibleIds.some((id) => selected.has(id))

  const toggleOne = useCallback((id: string, next: boolean) => {
    setSelected((prev) => {
      const copy = new Set(prev)
      if (next) copy.add(id)
      else copy.delete(id)
      return copy
    })
  }, [])

  const toggleAllVisible = useCallback(
    (next: boolean) => {
      setSelected((prev) => {
        const copy = new Set(prev)
        for (const id of visibleIds) {
          if (next) copy.add(id)
          else copy.delete(id)
        }
        return copy
      })
    },
    [visibleIds]
  )

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  const requestMaster = useCallback((word: VocabWord) => {
    setPendingAction({ type: "master", word })
  }, [])

  const requestIgnore = useCallback((word: VocabWord) => {
    setPendingAction({ type: "ignore", word })
  }, [])

  const handleGenerate = () => {
    if (selectedCount === 0 || overLimit) return
    const ids = Array.from(selected).join(",")
    navigate(`/articles/new?target_word_ids=${ids}`)
  }

  const toggleSort = useCallback(
    (column: SortBy) => {
      if (sortBy === column) {
        setSortDir((d) => (d === "desc" ? "asc" : "desc"))
      } else {
        setSortBy(column)
        setSortDir("desc")
      }
    },
    [sortBy]
  )

  if (isPending) {
    return <WeakSkeleton />
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          共 {total} 个薄弱词 · 已加载 {loadedWords.length} 个 ·
          勾选想练的词，一键生成定向文章
        </p>
        <p className="text-xs text-muted-foreground">
          已掌握 / 忽略的词不再出现在这里
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">反馈</Label>
          <Select
            value={responseFilter}
            onValueChange={(v: ResponseFilter) => setResponseFilter(v)}
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

        <Label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={stickingOnly}
            onCheckedChange={(v) => setStickingOnly(v === true)}
          />
          只看反复忘
        </Label>

        <div className="ms-auto flex items-center gap-1 text-xs text-muted-foreground">
          <span>
            显示已加载 {visible.length} · 已选 {selectedCount}
          </span>
          {selectedCount > 0 && (
            <Button variant="ghost" size="xs" onClick={clearSelection}>
              清空
            </Button>
          )}
        </div>
      </div>

      {isDesktop ? (
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    aria-label="全选当前已加载"
                    checked={
                      allVisibleSelected
                        ? true
                        : someVisibleSelected
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(v) => toggleAllVisible(v === true)}
                  />
                </TableHead>
                <TableHead>单词</TableHead>
                <TableHead>释义</TableHead>
                <TableHead>反馈</TableHead>
                <TableHead>
                  <SortButton
                    label="weak"
                    active={sortBy === "weak_score"}
                    dir={sortDir}
                    onClick={() => toggleSort("weak_score")}
                  />
                </TableHead>
                <TableHead>
                  <SortButton
                    label="练习"
                    active={sortBy === "study_count"}
                    dir={sortDir}
                    onClick={() => toggleSort("study_count")}
                  />
                </TableHead>
                <TableHead>标签</TableHead>
                <TableHead className="text-right">下次复习</TableHead>
                <TableHead className="w-10 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-16 text-center text-sm text-muted-foreground"
                  >
                    没有匹配当前筛选的薄弱词。
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((word) => (
                  <WordTableRow
                    key={word.id}
                    word={word}
                    selected={selected.has(word.id)}
                    onToggle={toggleOne}
                    onMaster={requestMaster}
                    onIgnore={requestIgnore}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div>
          {visible.length === 0 ? (
            <div className="rounded-2xl border border-border/60 py-16 text-center text-sm text-muted-foreground">
              没有匹配当前筛选的薄弱词。
            </div>
          ) : (
            <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60">
              {visible.map((word) => (
                <WordCardRow
                  key={word.id}
                  word={word}
                  selected={selected.has(word.id)}
                  onToggle={toggleOne}
                  onMaster={requestMaster}
                  onIgnore={requestIgnore}
                />
              ))}
            </div>
          )}
        </div>
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

      {selectedCount > 0 && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4"
          style={{
            paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
            paddingTop: "0.5rem",
          }}
        >
          <div
            className={cn(
              "pointer-events-auto flex w-full max-w-3xl items-center gap-3 rounded-3xl border bg-background/95 p-3 pl-5 shadow-lg ring-1 backdrop-blur supports-backdrop-filter:bg-background/70",
              overLimit
                ? "border-destructive/40 ring-destructive/20"
                : "border-border/60 ring-foreground/5"
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
              <HugeiconsIcon
                icon={overLimit ? AlertCircleIcon : SparklesIcon}
                size={18}
                strokeWidth={1.8}
                className={cn(overLimit && "text-destructive")}
              />
              <span className="truncate">
                已勾选 <strong className="tabular-nums">{selectedCount}</strong>{" "}
                个词
                {overLimit && (
                  <span className="text-destructive">
                    {" "}
                    · 超过单篇上限 {MAX_SELECTION}，请拆分成多篇
                  </span>
                )}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              清空
            </Button>
            <Button size="sm" onClick={handleGenerate} disabled={overLimit}>
              <HugeiconsIcon
                icon={SparklesIcon}
                data-icon="inline-start"
                strokeWidth={1.8}
              />
              从勾选生成
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 text-left text-xs tracking-wider uppercase transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span>{label}</span>
      {active && (
        <HugeiconsIcon
          icon={dir === "desc" ? ArrowDown01Icon : ArrowUp01Icon}
          size={12}
          strokeWidth={1.8}
        />
      )}
    </button>
  )
}

interface WordRowProps {
  word: VocabWord
  selected: boolean
  onToggle: (wordId: string, next: boolean) => void
  onMaster: (word: VocabWord) => void
  onIgnore: (word: VocabWord) => void
}

const WordTableRow = memo(function WordTableRow({
  word,
  selected,
  onToggle,
  onMaster,
  onIgnore,
}: WordRowProps) {
  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      aria-checked={selected}
      role="row"
      className="cursor-pointer focus-within:bg-muted/40"
      onClick={() => onToggle(word.id, !selected)}
    >
      <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          aria-label={`选择 ${word.spelling}`}
          checked={selected}
          onCheckedChange={(v) => onToggle(word.id, v === true)}
        />
      </TableCell>
      <TableCell>
        <div className="font-heading text-sm font-medium">{word.spelling}</div>
      </TableCell>
      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
        {word.translation}
      </TableCell>
      <TableCell>
        <LastResponseBadge value={word.last_response} />
      </TableCell>
      <TableCell>
        <WeakScoreMeter score={word.weak_score} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground tabular-nums">
        {word.study_count}
      </TableCell>
      <TableCell>
        {word.tags.includes("STICKING") && (
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            反复忘
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
        {formatDateShort(word.next_study_date)}
      </TableCell>
      <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
        <RowActions
          spelling={word.spelling}
          onMaster={() => onMaster(word)}
          onIgnore={() => onIgnore(word)}
        />
      </TableCell>
    </TableRow>
  )
})

/**
 * Mobile card equivalent of WordTableRow. Targets <md screens where the 10
 * column table would force horizontal scroll. Keeps the same selection /
 * action semantics so behaviour doesn't diverge across breakpoints.
 *
 * The outer card is a plain clickable container (role="button") that toggles
 * the inner real <Checkbox>, so screen readers only see a single checkbox
 * per row. Keyboard users can press Space / Enter on the card to toggle, or
 * Tab into the inner checkbox and activate directly.
 */
const WordCardRow = memo(function WordCardRow({
  word,
  selected,
  onToggle,
  onMaster,
  onIgnore,
}: WordRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`选择 ${word.spelling}，${word.translation}`}
      onClick={() => onToggle(word.id, !selected)}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault()
          onToggle(word.id, !selected)
        }
      }}
      className={cn(
        "flex gap-3 p-4 transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:-outline-offset-2 focus-visible:outline-none",
        selected ? "bg-muted/60" : "bg-card hover:bg-muted/30"
      )}
    >
      <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          aria-label={`选择 ${word.spelling}`}
          checked={selected}
          onCheckedChange={(v) => onToggle(word.id, v === true)}
        />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-heading text-base font-medium tracking-tight">
            {word.spelling}
          </div>
          <div className="flex items-baseline gap-1.5 text-xs text-muted-foreground tabular-nums">
            <WeakScoreMeter score={word.weak_score} variant="compact" />
            <span>weak</span>
          </div>
        </div>
        <div className="truncate text-sm text-muted-foreground">
          {word.translation}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <LastResponseBadge value={word.last_response} />
          {word.tags.includes("STICKING") && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              反复忘
            </Badge>
          )}
          <span className="text-muted-foreground">
            练习 {word.study_count} 次
          </span>
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
      <div className="self-start" onClick={(e) => e.stopPropagation()}>
        <RowActions
          spelling={word.spelling}
          onMaster={() => onMaster(word)}
          onIgnore={() => onIgnore(word)}
        />
      </div>
    </div>
  )
})

interface RowActionsProps {
  spelling: string
  onMaster: () => void
  onIgnore: () => void
}

function RowActions({ spelling, onMaster, onIgnore }: RowActionsProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`${spelling} 操作`}
          className="text-muted-foreground"
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={1.8} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1">
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            onMaster()
          }}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
        >
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            size={14}
            strokeWidth={1.8}
          />
          <span>标记为已掌握</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            onIgnore()
          }}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
        >
          <HugeiconsIcon icon={ViewOffSlashIcon} size={14} strokeWidth={1.8} />
          <span>暂时忽略</span>
        </button>
      </PopoverContent>
    </Popover>
  )
}

function WeakActionDialog({
  action,
  onOpenChange,
  onConfirm,
}: {
  action: { type: "master" | "ignore"; word: VocabWord } | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const isMaster = action?.type === "master"
  const spelling = action?.word.spelling ?? ""

  return (
    <AlertDialog open={action !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {isMaster ? (
            <>
              <AlertDialogTitle>
                把「{spelling}」标记为已掌握？
              </AlertDialogTitle>
              <AlertDialogDescription>
                它会从薄弱词列表消失，下次生成文章也不再优先挑选。
                稍后可以在「全部单词」里改回来。
              </AlertDialogDescription>
            </>
          ) : (
            <>
              <AlertDialogTitle>暂时忽略「{spelling}」？</AlertDialogTitle>
              <AlertDialogDescription>
                它会从薄弱词列表消失，但不会被标记为已掌握，下次同步后可能重新出现。
              </AlertDialogDescription>
            </>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {isMaster ? "标记已掌握" : "忽略"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function WeakSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-14 w-full rounded-2xl" />
      <div className="space-y-2 rounded-2xl border border-border/60 p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  )
}
