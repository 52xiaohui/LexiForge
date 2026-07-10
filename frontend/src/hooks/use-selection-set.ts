import { useCallback, useState } from "react"

/** Generic multi-select set for list rows (薄弱词 selection etc.). */
export function useSelectionSet<T extends string = string>() {
  const [selected, setSelected] = useState<Set<T>>(() => new Set())

  const toggleOne = useCallback((id: T, next: boolean) => {
    setSelected((prev) => {
      const copy = new Set(prev)
      if (next) copy.add(id)
      else copy.delete(id)
      return copy
    })
  }, [])

  const toggleMany = useCallback((ids: T[], next: boolean) => {
    setSelected((prev) => {
      const copy = new Set(prev)
      for (const id of ids) {
        if (next) copy.add(id)
        else copy.delete(id)
      }
      return copy
    })
  }, [])

  const remove = useCallback((id: T) => {
    setSelected((prev) => {
      if (!prev.has(id)) return prev
      const copy = new Set(prev)
      copy.delete(id)
      return copy
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  return {
    selected,
    selectedCount: selected.size,
    has: (id: T) => selected.has(id),
    toggleOne,
    toggleMany,
    remove,
    clear,
  }
}
