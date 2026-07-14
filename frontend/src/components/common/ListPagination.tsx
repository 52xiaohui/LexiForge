import {
  ArrowLeft01Icon,
  ArrowLeftDoubleIcon,
  ArrowRight01Icon,
  ArrowRightDoubleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { pageRange } from "@/lib/pagination"
import { cn } from "@/lib/utils"

export interface ListPaginationProps {
  page: number
  pageCount: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  /** Soft busy state while the next page is fetching. */
  isFetching?: boolean
  className?: string
  /**
   * Optional trailing slot (e.g. "已选 3") rendered on the right of the
   * range label on wide screens.
   */
  aside?: ReactNode
}

/**
 * Shared list pagination used by 全部单词 and 薄弱词.
 * Prev/next always; first/last appear when there are more than two pages.
 */
export function ListPagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  isFetching = false,
  className,
  aside,
}: ListPaginationProps) {
  const { start, end } = pageRange(page, pageSize, total)
  const showJumpEnds = pageCount > 2
  const atStart = page <= 1
  const atEnd = page >= pageCount

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground",
        className
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 transition-opacity",
          isFetching && "opacity-60"
        )}
      >
        <span className="tabular-nums">
          第 {page} / {pageCount} 页
          <span className="mx-1.5 text-border" aria-hidden>
            ·
          </span>
          {start}-{end} / {total}
        </span>
        {aside}
      </div>

      <div className="flex items-center gap-1">
        {showJumpEnds && (
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="第一页"
            disabled={atStart || isFetching}
            onClick={() => onPageChange(1)}
          >
            <HugeiconsIcon icon={ArrowLeftDoubleIcon} strokeWidth={1.8} />
          </Button>
        )}
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="上一页"
          disabled={atStart || isFetching}
          onClick={() => onPageChange(page - 1)}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={1.8} />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="下一页"
          disabled={atEnd || isFetching}
          onClick={() => onPageChange(page + 1)}
        >
          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={1.8} />
        </Button>
        {showJumpEnds && (
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="最后一页"
            disabled={atEnd || isFetching}
            onClick={() => onPageChange(pageCount)}
          >
            <HugeiconsIcon icon={ArrowRightDoubleIcon} strokeWidth={1.8} />
          </Button>
        )}
      </div>
    </div>
  )
}
