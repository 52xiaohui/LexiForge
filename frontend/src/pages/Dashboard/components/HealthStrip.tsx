import {
  AlertCircleIcon,
  Book02Icon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  formatAbsoluteTime,
  formatCount,
  formatRelativeTime,
} from "@/lib/formatters"
import { computeSyncStatus } from "@/lib/sync"
import { cn } from "@/lib/utils"

export interface HealthStripProps {
  total: number
  weak: number
  stickingCount?: number
  lastSync: string | null
  isLoading?: boolean
  isSyncing?: boolean
  syncCooldownRemaining?: number
  onSync?: () => void
}

/**
 * One-line library health: totals, weak backlog, sync freshness.
 * Replaces the three StatCards so attention stays on the primary action card.
 */
export function HealthStrip({
  total,
  weak,
  stickingCount = 0,
  lastSync,
  isLoading,
  isSyncing = false,
  syncCooldownRemaining = 0,
  onSync,
}: HealthStripProps) {
  if (isLoading) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="ms-auto h-8 w-20" />
      </div>
    )
  }

  const weakPct = total > 0 ? Math.round((weak / total) * 100) : 0
  const syncStatus = computeSyncStatus(lastSync)
  const syncDisabled = isSyncing || syncCooldownRemaining > 0

  return (
    <section
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-card px-4 py-3",
        syncStatus === "stale" || syncStatus === "never"
          ? "border-amber-500/35"
          : "border-border/60"
      )}
    >
      <Link
        to="/vocab"
        className="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-foreground"
      >
        <HugeiconsIcon
          icon={Book02Icon}
          size={14}
          strokeWidth={1.8}
          className="text-muted-foreground"
        />
        <span className="font-heading font-semibold tabular-nums">
          {formatCount(total)}
        </span>
        <span className="text-muted-foreground">词</span>
      </Link>

      <span className="text-border" aria-hidden>
        ·
      </span>

      <Link
        to="/vocab/weak"
        className="inline-flex items-center gap-1.5 text-sm transition-colors hover:text-foreground"
      >
        <HugeiconsIcon
          icon={AlertCircleIcon}
          size={14}
          strokeWidth={1.8}
          className="text-amber-600 dark:text-amber-400"
        />
        <span className="font-heading font-semibold tabular-nums">
          {formatCount(weak)}
        </span>
        <span className="text-muted-foreground">
          薄弱
          {total > 0 && (
            <span className="tabular-nums"> ({weakPct}%)</span>
          )}
        </span>
      </Link>

      {stickingCount > 0 && (
        <>
          <span className="text-border" aria-hidden>
            ·
          </span>
          <span className="text-sm text-muted-foreground">
            反复忘{" "}
            <span className="font-heading font-medium text-foreground tabular-nums">
              {formatCount(stickingCount)}
            </span>
          </span>
        </>
      )}

      <span className="text-border" aria-hidden>
        ·
      </span>

      <div
        className={cn(
          "text-sm",
          syncStatus === "fresh"
            ? "text-muted-foreground"
            : "text-amber-700 dark:text-amber-400"
        )}
        title={lastSync ? formatAbsoluteTime(lastSync) : undefined}
      >
        {syncStatus === "never"
          ? "尚未同步"
          : syncStatus === "stale"
            ? `同步 ${formatRelativeTime(lastSync)} · 可能过期`
            : `同步 ${formatRelativeTime(lastSync)}`}
      </div>

      {onSync && (
        <Button
          size="sm"
          variant={syncStatus === "fresh" ? "ghost" : "outline"}
          className="ms-auto"
          disabled={syncDisabled}
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
            : syncCooldownRemaining > 0
              ? `${syncCooldownRemaining}s`
              : "同步"}
        </Button>
      )}
    </section>
  )
}
