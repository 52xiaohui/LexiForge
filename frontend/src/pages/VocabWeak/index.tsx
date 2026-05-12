import {
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { LastResponseBadge } from "@/components/common/LastResponseBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateShort } from "@/lib/formatters"
import { mockStore } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import type { LastResponse, VocabWord } from "@/types/api"

type ResponseFilter = "ALL" | LastResponse
type SortBy = "weak_score" | "study_count"
type SortDir = "asc" | "desc"

const MAX_SELECTION = 80

export function VocabWeak() {
  const navigate = useNavigate()
  const [responseFilter, setResponseFilter] = useState<ResponseFilter>("ALL")
  const [stickingOnly, setStickingOnly] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>("weak_score")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data = [] } = useQuery({
    queryKey: ["vocab", "weak"],
    queryFn: async () => mockStore.listWeakWords(),
  })

  const visible = useMemo(() => {
    let rows = data.slice()
    if (responseFilter !== "ALL") {
      rows = rows.filter((w) => w.last_response === responseFilter)
    }
    if (stickingOnly) {
      rows = rows.filter((w) => w.tags.includes("STICKING"))
    }
    rows.sort((a, b) => {
      const diff = a[sortBy] - b[sortBy]
      return sortDir === "desc" ? -diff : diff
    })
    return rows
  }, [data, responseFilter, stickingOnly, sortBy, sortDir])

  const selectedCount = selected.size
  const overLimit = selectedCount > MAX_SELECTION
  const visibleIds = visible.map((w) => w.id)
  const allVisibleSelected =
    visible.length > 0 && visibleIds.every((id) => selected.has(id))
  const someVisibleSelected =
    !allVisibleSelected && visibleIds.some((id) => selected.has(id))

  const toggleOne = (id: string, next: boolean) => {
    setSelected((prev) => {
      const copy = new Set(prev)
      if (next) copy.add(id)
      else copy.delete(id)
      return copy
    })
  }

  const toggleAllVisible = (next: boolean) => {
    setSelected((prev) => {
      const copy = new Set(prev)
      for (const id of visibleIds) {
        if (next) copy.add(id)
        else copy.delete(id)
      }
      return copy
    })
  }

  const clearSelection = () => setSelected(new Set())

  const handleGenerate = () => {
    if (selectedCount === 0 || overLimit) return
    const ids = Array.from(selected).join(",")
    navigate(`/articles/new?target_word_ids=${ids}`)
  }

  const toggleSort = (column: SortBy) => {
    if (sortBy === column) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    } else {
      setSortBy(column)
      setSortDir("desc")
    }
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          共 {data.length} 个薄弱词 · 勾选你要精练的词，一键生成定向文章
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
          只看反复忘（STICKING）
        </Label>

        <div className="ms-auto flex items-center gap-1 text-xs text-muted-foreground">
          <span>
            显示 {visible.length} · 已选 {selectedCount}
          </span>
          {selectedCount > 0 && (
            <Button variant="ghost" size="xs" onClick={clearSelection}>
              清空
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-10 pl-4">
                <Checkbox
                  aria-label="全选当前筛选"
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
                  label="练习次数"
                  active={sortBy === "study_count"}
                  dir={sortDir}
                  onClick={() => toggleSort("study_count")}
                />
              </TableHead>
              <TableHead>标签</TableHead>
              <TableHead className="pr-4 text-right">下次复习</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center text-sm text-muted-foreground">
                  没有匹配当前筛选的薄弱词。
                </TableCell>
              </TableRow>
            ) : (
              visible.map((word) => (
                <WordRow
                  key={word.id}
                  word={word}
                  selected={selected.has(word.id)}
                  onToggle={(v) => toggleOne(word.id, v)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {selectedCount > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-6">
          <div
            className={cn(
              "pointer-events-auto flex w-full max-w-3xl items-center gap-3 rounded-3xl border bg-background/95 p-3 pl-5 shadow-lg ring-1 backdrop-blur supports-backdrop-filter:bg-background/70",
              overLimit
                ? "border-destructive/40 ring-destructive/20"
                : "border-border/60 ring-foreground/5",
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
                已勾选 <strong className="tabular-nums">{selectedCount}</strong> 个词
                {overLimit && (
                  <span className="text-destructive">
                    {" "}· 超过单篇上限 {MAX_SELECTION}，请拆分成多篇
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
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
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

function WordRow({
  word,
  selected,
  onToggle,
}: {
  word: VocabWord
  selected: boolean
  onToggle: (next: boolean) => void
}) {
  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      className="cursor-pointer"
      onClick={() => onToggle(!selected)}
    >
      <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          aria-label={`选择 ${word.spelling}`}
          checked={selected}
          onCheckedChange={(v) => onToggle(v === true)}
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
      <TableCell className="font-heading text-sm tabular-nums">
        {word.weak_score}
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
      <TableCell className="pr-4 text-right text-xs text-muted-foreground tabular-nums">
        {formatDateShort(word.next_study_date)}
      </TableCell>
    </TableRow>
  )
}
