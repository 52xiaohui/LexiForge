import { HugeiconsIcon } from "@hugeicons/react"
import { Link, useLocation } from "react-router-dom"

import { useVocabSummary } from "@/hooks/use-vocab-summary"
import { cn } from "@/lib/utils"

import {
  formatWeakBadge,
  isNavItemActive,
  mobileTabItems,
  shouldHideMobileTabBar,
} from "./nav"

/**
 * Practice-first bottom tabs for phones/tablets. Hidden on article reading
 * so the reader can use its own mobile chrome.
 */
export function MobileBottomNav() {
  const { pathname } = useLocation()
  const { data: summary } = useVocabSummary({ silent: true })
  const weakBadge = formatWeakBadge(summary?.weak)

  if (shouldHideMobileTabBar(pathname)) return null

  return (
    <nav
      aria-label="主导航"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex h-14 max-w-lg items-stretch justify-between px-1">
        {mobileTabItems.map((item) => {
          const active = isNavItemActive(item, pathname)
          const badge = item.badge === "weak" ? weakBadge : null
          const isPrimary = Boolean(item.primary)

          return (
            <li key={item.to} className="flex min-w-0 flex-1">
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isPrimary ? (
                  <span
                    className={cn(
                      "mb-0.5 grid size-10 place-items-center rounded-2xl text-primary-foreground shadow-sm",
                      active ? "bg-primary" : "bg-primary/90"
                    )}
                  >
                    <HugeiconsIcon icon={item.icon} size={18} strokeWidth={1.8} />
                  </span>
                ) : (
                  <span className="relative">
                    <HugeiconsIcon icon={item.icon} size={20} strokeWidth={1.8} />
                    {badge && (
                      <span className="absolute -top-1 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[8px] font-semibold text-white tabular-nums">
                        {Number(badge) > 99 ? "99+" : badge}
                      </span>
                    )}
                  </span>
                )}
                <span className="max-w-full truncate">
                  {item.shortLabel ?? item.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
