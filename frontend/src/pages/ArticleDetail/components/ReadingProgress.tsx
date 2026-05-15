import { useEffect, useState } from "react"

/**
 * Sticky 2px scroll-progress bar that pins to just below the AppShell TopBar.
 *
 * Implementation notes:
 * - Listens to `window.scroll` directly rather than wrapping the article in a
 *   scroll container, because the document scroll is what the reader's eye
 *   actually tracks (the TopBar is sticky on the same scrollport).
 * - `passive: true` keeps the listener from blocking the scroll thread.
 */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const update = () => {
      const doc = document.documentElement
      const scrolled = doc.scrollTop
      const max = doc.scrollHeight - doc.clientHeight
      const pct = max > 0 ? Math.min(100, (scrolled / max) * 100) : 0
      setProgress(pct)
    }
    update()
    window.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      window.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [])

  return (
    <div
      role="progressbar"
      aria-label="阅读进度"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="sticky top-16 z-20 h-[2px] overflow-hidden rounded-full bg-border/40"
    >
      <div
        className="h-full bg-foreground transition-[width] duration-150"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
