import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { LastResponseBadge } from "@/components/common/LastResponseBadge"
import { WeakScoreMeter } from "@/components/common/WeakScoreMeter"
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
import type { LastResponse } from "@/types/api"

type ResponseFilter = "ALL" | LastResponse

const PAGE_SIZE = 15

export function Vocab() {
  const [search, setSearch] = useState("")
  const [responseFilter, setResponseFilter] = useState<ResponseFilter>("ALL")
  const [page, setPage] = useState(1)

  const { data = [] } = useQuery({
    queryKey: ["vocab", "words"],
    queryFn: async () => mockStore.listWords(),
  })

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return data.filter((w) => {
      if (responseFilter !== "ALL" && w.last_response !== responseFilter) {
        return false
      }
      if (!query) return true
      return (
        w.spelling.toLowerCase().includes(query) ||
        w.translation.toLowerCase().includes(query)
      )
    })
  }, [data, search, responseFilter])

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

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        共 {data.length} 个词 · 搜索或筛选查看你当前的学习进度
      </p>

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
              setPage(1)
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
              setPage(1)
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

      <div className="overflow-hidden rounded-2xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="pl-4">单词</TableHead>
              <TableHead>释义</TableHead>
              <TableHead>反馈</TableHead>
              <TableHead>weak</TableHead>
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
                    <WeakScoreMeter score={word.weak_score} />
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
