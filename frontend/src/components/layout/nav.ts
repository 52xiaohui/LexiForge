import {
  AlertCircleIcon,
  Book02Icon,
  DashboardCircleIcon,
  Notebook02Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"

export interface AppNavItem {
  to: string
  label: string
  shortLabel?: string
  icon: IconSvgElement
  /** Exact path match only. */
  end?: boolean
  match?: (pathname: string) => boolean
  /** Emphasize as primary product action (generate). */
  primary?: boolean
  /** Show weak-count badge when available. */
  badge?: "weak"
}

export function isNavItemActive(item: AppNavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname)
  if (item.end) return pathname === item.to
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

/** Desktop sidebar list (generate is rendered separately as a CTA). */
export const sidebarNavItems: AppNavItem[] = [
  { to: "/dashboard", label: "总览", icon: DashboardCircleIcon },
  { to: "/vocab/weak", label: "薄弱词", icon: AlertCircleIcon, badge: "weak" },
  { to: "/vocab", label: "全部单词", icon: Book02Icon, end: true },
  {
    to: "/articles",
    label: "文章历史",
    icon: Notebook02Icon,
    match: (p) =>
      p === "/articles" || (p.startsWith("/articles/") && p !== "/articles/new"),
  },
]

export const generateNavItem: AppNavItem = {
  to: "/articles/new",
  label: "生成文章",
  shortLabel: "生成",
  icon: SparklesIcon,
  primary: true,
}

/**
 * Mobile bottom bar — practice-first order.
 * Generate sits in the center slot in the UI.
 */
export const mobileTabItems: AppNavItem[] = [
  { to: "/dashboard", label: "总览", shortLabel: "总览", icon: DashboardCircleIcon },
  {
    to: "/vocab/weak",
    label: "薄弱词",
    shortLabel: "薄弱",
    icon: AlertCircleIcon,
    badge: "weak",
  },
  generateNavItem,
  { to: "/vocab", label: "全部单词", shortLabel: "词库", icon: Book02Icon, end: true },
  {
    to: "/articles",
    label: "文章历史",
    shortLabel: "历史",
    icon: Notebook02Icon,
    match: (p) =>
      p === "/articles" || (p.startsWith("/articles/") && p !== "/articles/new"),
  },
]

/** Hide mobile bottom tabs on long-form reading. */
export function shouldHideMobileTabBar(pathname: string): boolean {
  return (
    pathname.startsWith("/articles/") &&
    pathname !== "/articles/new" &&
    !pathname.endsWith("/new")
  )
}

export function formatWeakBadge(count: number | undefined): string | null {
  if (count == null || count <= 0) return null
  if (count > 999) return "999+"
  return String(count)
}

/**
 * Compact badge label for icon-sized chips (sidebar rail / mobile tabs).
 * Accepts either a numeric string or the "999+" overflow form.
 */
export function formatCompactBadge(
  badge: string,
  compactMax = 99
): string {
  if (badge.endsWith("+")) {
    const n = Number(badge.slice(0, -1))
    if (Number.isFinite(n) && n > compactMax) return `${compactMax}+`
    return badge
  }
  const n = Number(badge)
  if (Number.isFinite(n) && n > compactMax) return `${compactMax}+`
  return badge
}
