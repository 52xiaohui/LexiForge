import { useCallback, useEffect, useState } from "react"

export type ReadingFontSize = "sm" | "md" | "lg" | "xl"
export type ReadingFontFamily = "sans" | "serif"
/**
 * Page tint applied to the reading surface itself. Distinct from the global
 * light/dark theme — sepia overlays a warm tone that some readers prefer for
 * long sessions and works on top of the underlying light theme.
 */
export type ReadingTone = "default" | "sepia"

export interface ReadingPrefs {
  fontSize: ReadingFontSize
  fontFamily: ReadingFontFamily
  tone: ReadingTone
  /**
   * Centred reading column with right-side panels collapsed into a drawer.
   * Default `true` for the new layout — long-form content lives center-stage.
   */
  focusMode: boolean
  /**
   * Hide target translations behind a tap. Trains the reader to attempt
   * recognition before falling back to the gloss.
   */
  challengeMode: boolean
  /**
   * Surface inline ✓/? affordance at the end of every paragraph for the
   * "I got this / I'm stuck" self-assessment. Some readers prefer the
   * cleaner look without it.
   */
  paragraphFeedback: boolean
}

const STORAGE_KEY = "lexiforge.readingPrefs"

const DEFAULTS: ReadingPrefs = {
  fontSize: "md",
  fontFamily: "serif",
  tone: "default",
  focusMode: true,
  challengeMode: false,
  paragraphFeedback: true,
}

function readPrefs(): ReadingPrefs {
  if (typeof window === "undefined") return DEFAULTS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<ReadingPrefs>
    return {
      fontSize: parsed.fontSize ?? DEFAULTS.fontSize,
      fontFamily: parsed.fontFamily ?? DEFAULTS.fontFamily,
      tone: parsed.tone ?? DEFAULTS.tone,
      focusMode: parsed.focusMode ?? DEFAULTS.focusMode,
      challengeMode: parsed.challengeMode ?? DEFAULTS.challengeMode,
      paragraphFeedback: parsed.paragraphFeedback ?? DEFAULTS.paragraphFeedback,
    }
  } catch {
    return DEFAULTS
  }
}

/**
 * Persistent reading preferences used on the ArticleDetail page. A single
 * `localStorage` key keeps the shape across sessions so returning readers
 * don't have to re-pick every time. The shape is forward-compatible — adding
 * a new key falls back to the default for users with the old payload.
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

  const setFontFamily = useCallback((fontFamily: ReadingFontFamily) => {
    setPrefs((p) => ({ ...p, fontFamily }))
  }, [])

  const setTone = useCallback((tone: ReadingTone) => {
    setPrefs((p) => ({ ...p, tone }))
  }, [])

  const setFocusMode = useCallback((focusMode: boolean) => {
    setPrefs((p) => ({ ...p, focusMode }))
  }, [])

  const toggleFocusMode = useCallback(() => {
    setPrefs((p) => ({ ...p, focusMode: !p.focusMode }))
  }, [])

  const setChallengeMode = useCallback((challengeMode: boolean) => {
    setPrefs((p) => ({ ...p, challengeMode }))
  }, [])

  const toggleChallengeMode = useCallback(() => {
    setPrefs((p) => ({ ...p, challengeMode: !p.challengeMode }))
  }, [])

  const setParagraphFeedback = useCallback((paragraphFeedback: boolean) => {
    setPrefs((p) => ({ ...p, paragraphFeedback }))
  }, [])

  const toggleParagraphFeedback = useCallback(() => {
    setPrefs((p) => ({ ...p, paragraphFeedback: !p.paragraphFeedback }))
  }, [])

  return {
    ...prefs,
    setFontSize,
    setFontFamily,
    setTone,
    setFocusMode,
    toggleFocusMode,
    setChallengeMode,
    toggleChallengeMode,
    setParagraphFeedback,
    toggleParagraphFeedback,
  }
}

export const FONT_SIZE_ORDER: ReadingFontSize[] = ["sm", "md", "lg", "xl"]

export const FONT_SIZE_LABELS: Record<ReadingFontSize, string> = {
  sm: "A·小",
  md: "A·中",
  lg: "A·大",
  xl: "A·特大",
}

export const FONT_FAMILY_LABELS: Record<ReadingFontFamily, string> = {
  sans: "无衬线",
  serif: "衬线",
}

export const TONE_LABELS: Record<ReadingTone, string> = {
  default: "标准",
  sepia: "护眼",
}
