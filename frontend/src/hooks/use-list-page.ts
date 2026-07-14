import { useCallback, useState } from "react"

import { clampPage, pageCountOf } from "@/lib/pagination"

/**
 * Page index state that auto-clamps when the total/pageCount shrinks
 * (e.g. after filtering). Resets to page 1 when filters change via `reset`.
 */
export function useListPage(total: number, pageSize: number) {
  const pageCount = pageCountOf(total, pageSize)
  const [page, setPageRaw] = useState(1)

  // Clamp during render when totals change (React-recommended pattern).
  const [trackedPageCount, setTrackedPageCount] = useState(pageCount)
  if (trackedPageCount !== pageCount) {
    setTrackedPageCount(pageCount)
    if (page > pageCount) setPageRaw(pageCount)
  }

  const setPage = useCallback(
    (next: number) => {
      setPageRaw(clampPage(next, pageCount))
    },
    [pageCount]
  )

  const reset = useCallback(() => setPageRaw(1), [])

  return {
    page,
    pageCount,
    setPage,
    reset,
  }
}
