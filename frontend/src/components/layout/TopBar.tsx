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
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/formatters"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { RouteHandle } from "@/app/router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { toast } from "sonner"

function isRouteHandle(handle: unknown): handle is RouteHandle {
  return typeof handle === "object" && handle !== null && "title" in handle
}

const SYNC_STALE_HOURS = 24

type SyncStatus = "fresh" | "stale" | "never"

function computeSyncStatus(
  lastSyncedAt: string | null | undefined
): SyncStatus {
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

  const queryClient = useQueryClient()
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  const { data: summary } = useQuery({
    queryKey: ["vocab", "summary"],
    queryFn: () => api.vocabSummary(),
    // Silence global toast for the TopBar query — the Dashboard will surface
    // its own state and we don't want two toasts for the same failure.
    meta: { silent: true },
  })

  const cooldownRemaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000))

  useEffect(() => {
    if (cooldownRemaining <= 0) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [cooldownRemaining])

  const sync = useMutation({
    mutationFn: () => api.syncMaimemo(),
    meta: { silent: true },
    onSuccess: (result) => {
      setCooldownUntil(Date.now() + 30_000)
      setNow(Date.now())
      queryClient.invalidateQueries({ queryKey: ["vocab"] })
      queryClient.invalidateQueries({ queryKey: ["generate"] })
      toast.success(result.cached ? "同步结果已复用" : "同步完成", {
        description: `${result.records_inserted} 新增，${result.records_updated} 更新。`,
      })
      if (result.warning) {
        toast.warning("同步完成但有未取回记录", {
          description: result.warning,
        })
      }
    },
    onError: (error) => {
      toast.error("同步失败", {
        description:
          error instanceof Error
            ? error.message
            : "请检查后端和 MAIMEMO_TOKEN。",
      })
    },
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
          <div className="truncate font-heading text-base leading-tight font-medium">
            {title}
          </div>
          {subtitle && (
            <div className="truncate text-xs text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>

        <SyncStatusButton
          lastSyncedAt={summary?.last_synced_at ?? null}
          isSyncing={sync.isPending}
          cooldownRemaining={cooldownRemaining}
          onSync={() => sync.mutate()}
        />
        <ThemeToggle />
      </div>
    </header>
  )
}

function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  const toggle = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  // The icon represents the theme the button will *switch to*, which is the
  // standard pattern. Driving it off `resolvedTheme` ensures the icon stays
  // accurate when the user is on `system` and the OS flips its preference.
  const nextIcon: IconSvgElement =
    resolvedTheme === "dark" ? Sun01Icon : Moon02Icon

  const label = resolvedTheme === "dark" ? "切换到浅色模式" : "切换到深色模式"

  const systemHint = theme === "system" ? " · 当前跟随系统" : ""

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
        {label} <span className="opacity-60">(按 D{systemHint})</span>
      </TooltipContent>
    </Tooltip>
  )
}

interface SyncStatusButtonProps {
  lastSyncedAt: string | null
  isSyncing: boolean
  cooldownRemaining: number
  onSync: () => void
}

function SyncStatusButton({
  lastSyncedAt,
  isSyncing,
  cooldownRemaining,
  onSync,
}: SyncStatusButtonProps) {
  const status = computeSyncStatus(lastSyncedAt)
  const icon = isSyncing
    ? Refresh01Icon
    : status === "fresh"
      ? CheckmarkCircle02Icon
      : status === "stale"
        ? AlertCircleIcon
        : Refresh01Icon

  const label = isSyncing
    ? "同步中"
    : status === "fresh"
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
            // Below `sm` there is no label; collapse the pill into a square
            // icon-sized button so it doesn't render as an empty stretched
            // pill next to the icon-sm Menu button. The `!` overrides
            // size="sm"'s built-in `has-data-[icon=inline-start]:pl-2`.
            "aspect-square w-8 !px-0 sm:aspect-auto sm:w-auto sm:!px-3 sm:has-data-[icon=inline-start]:!pl-2",
            "tabular-nums",
            status === "stale" &&
              "border-amber-500/40 text-amber-600 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-400",
            status === "fresh" && "text-muted-foreground"
          )}
        >
          <HugeiconsIcon
            icon={icon}
            data-icon="inline-start"
            strokeWidth={1.8}
            className={cn(isSyncing && "animate-spin")}
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
              {status === "fresh"
                ? "数据已是最新"
                : status === "stale"
                  ? "数据可能过期"
                  : "还没有同步过"}
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
            MVP 阶段通过环境变量{" "}
            <code className="rounded bg-background px-1 py-0.5 text-[11px]">
              MAIMEMO_TOKEN
            </code>{" "}
            触发后端同步。同步会直接调用后端并写入本地数据库。
          </div>
          <Button
            size="sm"
            className="w-full"
            disabled={isSyncing || cooldownRemaining > 0}
            onClick={onSync}
          >
            <HugeiconsIcon
              icon={Refresh01Icon}
              data-icon="inline-start"
              strokeWidth={1.8}
              className={cn(isSyncing && "animate-spin")}
            />
            {isSyncing
              ? "同步中"
              : cooldownRemaining > 0
                ? `${cooldownRemaining}s 后可再次同步`
                : "立即同步墨墨"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
