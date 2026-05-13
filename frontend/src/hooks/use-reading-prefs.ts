import { useCallback, useEffect, useState } from "react"

export type ReadingFontSize = "sm" | "md" | "lg" | "xl"

export interface ReadingPrefs {
  fontSize: ReadingFontSize
  focusMode: boolean
}

const STORAGE_KEY = "lexiforge.readingPrefs"

const DEFAULTS: ReadingPrefs = {
  fontSize: "md",
  focusMode: false,
}

function readPrefs(): ReadingPrefs {
  if (typeof window === "undefined") return DEFAULTS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<ReadingPrefs>
    return {
      fontSize: parsed.fontSize ?? DEFAULTS.fontSize,
      focusMode: parsed.focusMode ?? DEFAULTS.focusMode,
    }
  } catch {
    return DEFAULTS
  }
}

/**
 * Persistent reading preferences used on the ArticleDetail page. A single
 * `localStorage` key keeps font size + focus mode across sessions so returning
 * readers don't have to re-pick every time.
 */
export function useReadingPrefs() {
  const [prefs, setPrefs] = useState<ReadingPrefs>(readPrefs)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
    } catch {
      // non-fatal (private mode, quota, etc.)
    }
  }, [prefs])

  const setFontSize = useCallback((fontSize: ReadingFontSize) => {
    setPrefs((p) => ({ ...p, fontSize }))
  }, [])

  const setFocusMode = useCallback((focusMode: boolean) => {
    setPrefs((p) => ({ ...p, focusMode }))
  }, [])

  const toggleFocusMode = useCallback(() => {
    setPrefs((p) => ({ ...p, focusMode: !p.focusMode }))
  }, [])

  return {
    ...prefs,
    setFontSize,
    setFocusMode,
    toggleFocusMode,
  }
}

export const FONT_SIZE_ORDER: ReadingFontSize[] = ["sm", "md", "lg", "xl"]

export const FONT_SIZE_LABELS: Record<ReadingFontSize, string> = {
  sm: "A·小",
  md: "A·中",
  lg: "A·大",
  xl: "A·特大",
}
