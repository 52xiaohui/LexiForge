/** Shared list pagination defaults for vocab surfaces. */
export const DEFAULT_PAGE_SIZE = 50

export function pageCountOf(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize))
}

export function pageRange(
  page: number,
  pageSize: number,
  total: number
): { start: number; end: number } {
  if (total === 0) return { start: 0, end: 0 }
  const start = (page - 1) * pageSize + 1
  const end = Math.min(total, page * pageSize)
  return { start, end }
}

/** Clamp page into [1, pageCount]. */
export function clampPage(page: number, pageCount: number): number {
  return Math.min(Math.max(1, page), Math.max(1, pageCount))
}
