import { useCallback, useState } from "react"

export type SortDir = "asc" | "desc"

export function useSortState<T extends string>(
  initialColumn: T,
  initialDir: SortDir = "desc"
) {
  const [sortBy, setSortBy] = useState<T>(initialColumn)
  const [sortDir, setSortDir] = useState<SortDir>(initialDir)

  const toggleSort = useCallback(
    (column: T) => {
      if (sortBy === column) {
        setSortDir((d) => (d === "desc" ? "asc" : "desc"))
      } else {
        setSortBy(column)
        setSortDir("desc")
      }
    },
    [sortBy]
  )

  return { sortBy, sortDir, toggleSort, setSortBy, setSortDir }
}
