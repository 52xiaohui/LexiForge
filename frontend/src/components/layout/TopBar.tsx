import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Menu02Icon,
  Moon02Icon,
  Refresh01Icon,
  Sun01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { useMatches } from "react-router-dom"

import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  formatAbsoluteTime,
  formatRelativeTime,
} from "@/lib/formatters"
import { mockStore } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import type { RouteHandle } from "@/app/router"

function isRouteHandle(handle: unknown): handle is RouteHandle {
  return typeof handle === "object" && handle !== null && "title" in handle
}

const SYNC_STALE_HOURS = 24

type SyncStatus = "fresh" | "stale" | "never"

function computeSyncStatus(lastSyncedAt: string | null | undefined): SyncStatus {
  if (!lastSyncedAt) return "never"
  const diff = Date.now() - new Date(lastSyncedAt).getTime()
  if (diff > SYNC_STALE_HOURS * 60 * 60 * 1000) return "stale"
  return "fresh"
}

export interface TopBarProps {
  onMobileMenuClick: () => void
}

export function TopBar({ onMobileMenuClick }: TopBarProps) {
  const matches = useMatches()
  const current = matches.at(-1)
  const handle = isRouteHandle(current?.handle) ? current.handle : null
  const title = handle?.title ?? ""
  const subtitle = handle?.subtitle

  const { data: summary } = useQuery({
    queryKey: ["vocab", "summary"],
    queryFn: async () => mockStore.vocabSummary(),
    // Silence global toast for the TopBar query — the Dashboard will surface
    // its own state and we don't want two toasts for the same failure.
    meta: { silent: true },
  })

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-6 lg:px-10">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="打开菜单"
          className="lg:hidden"
          onClick={onMobileMenuClick}
        >
          <HugeiconsIcon icon={Menu02Icon} strokeWidth={1.8} />
        </Button>

        <div className="min-w-0 flex-1">
          <div className="truncate font-heading text-base font-medium leading-tight">
            {title}
          </div>
          {subtitle && (
            <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
          )}
        </div>

        <SyncStatusButton lastSyncedAt={summary?.last_synced_at ?? null} />
        <ThemeToggle />
      </div>
    </header>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const toggle = () => {
    const resolved =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme
    setTheme(resolved === "dark" ? "light" : "dark")
  }

  // Eager resolution so the icon matches the current rendered theme (matters
  // when the user is on "system"). The rendered icon represents the theme you
  // will *switch to*, which is the industry-standard pattern.
  const nextIcon: IconSvgElement =
    theme === "dark" || (theme === "system" && matchMediaDarkIfAvailable())
      ? Sun01Icon
      : Moon02Icon

  const label =
    theme === "dark" || (theme === "system" && matchMediaDarkIfAvailable())
      ? "切换到浅色模式"
      : "切换到深色模式"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onClick={toggle}
        >
          <HugeiconsIcon icon={nextIcon} strokeWidth={1.8} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label} <span className="opacity-60">(按 D)</span>
      </TooltipContent>
    </Tooltip>
  )
}

function matchMediaDarkIfAvailable(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

interface SyncStatusButtonProps {
  lastSyncedAt: string | null
}

function SyncStatusButton({ lastSyncedAt }: SyncStatusButtonProps) {
  const status = computeSyncStatus(lastSyncedAt)
  const icon =
    status === "fresh" ? CheckmarkCircle02Icon
      : status === "stale" ? AlertCircleIcon
        : Refresh01Icon

  const label =
    status === "fresh"
      ? `同步 · ${formatRelativeTime(lastSyncedAt)}`
      : status === "stale"
        ? "数据过期"
        : "未同步"

  const a11yLabel = `同步状态：${label}。点击查看详情。`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={status === "fresh" ? "ghost" : "outline"}
          size="sm"
          aria-label={a11yLabel}
          className={cn(
            "tabular-nums",
            status === "stale" &&
              "border-destructive/40 text-destructive hover:text-destructive",
            status === "fresh" && "text-muted-foreground",
          )}
        >
          <HugeiconsIcon
            icon={icon}
            data-icon="inline-start"
            strokeWidth={1.8}
          />
          {/* Hide the label on narrow phones to save space; the icon itself
              conveys status and the Popover carries the detail. */}
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={icon} size={16} strokeWidth={1.8} />
            <span className="font-heading text-sm font-medium">
              {status === "fresh" ? "数据已是最新" : status === "stale" ? "数据可能过期" : "还没有同步过"}
            </span>
          </div>
          {lastSyncedAt ? (
            <p className="text-xs text-muted-foreground">
              上次同步 {formatAbsoluteTime(lastSyncedAt)}
              {"（"}
              {formatRelativeTime(lastSyncedAt)}
              {"）"}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              LexiForge 还未从墨墨拉取过任何学习记录。
            </p>
          )}
          <div className="rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
            MVP 阶段通过环境变量
            {" "}
            <code className="rounded bg-background px-1 py-0.5 text-[11px]">
              MAIMEMO_TOKEN
            </code>
            {" "}
            触发后端同步。下个版本会把触发按钮接到界面上。
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
