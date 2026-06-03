import type { ReactNode } from "react"

import { AlertCircleIcon, RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type StatusTone = "default" | "destructive"

const toneStyles: Record<StatusTone, string> = {
  default: "bg-muted text-foreground",
  destructive: "bg-destructive/10 text-destructive",
}

export interface StatusPanelProps {
  icon: IconSvgElement
  title: ReactNode
  description?: ReactNode
  tone?: StatusTone
  /** Center within a tall min-height block (full-page surfaces). Default true. */
  inset?: boolean
  /** Action slot rendered under the description (buttons, links). */
  action?: ReactNode
  className?: string
}

/**
 * Centered icon + title + description + action layout shared by empty, error
 * and not-found surfaces. Mirrors the existing `ErrorBoundary` fallback so the
 * whole app speaks the same visual language for "there's nothing to show here".
 */
export function StatusPanel({
  icon,
  title,
  description,
  tone = "default",
  inset = true,
  action,
  className,
}: StatusPanelProps) {
  return (
    <div
      className={cn(
        "grid place-items-center px-6",
        inset && "min-h-[60vh]",
        className,
      )}
    >
      <div className="max-w-md text-center">
        <div
          className={cn(
            "mx-auto mb-6 grid size-14 place-items-center rounded-3xl",
            toneStyles[tone],
          )}
        >
          <HugeiconsIcon icon={icon} size={22} strokeWidth={1.6} />
        </div>
        <div className="font-heading text-2xl font-semibold tracking-tight">
          {title}
        </div>
        {description && (
          <p className="mt-3 text-sm text-muted-foreground">{description}</p>
        )}
        {action && (
          <div className="mt-6 flex items-center justify-center gap-2">
            {action}
          </div>
        )}
      </div>
    </div>
  )
}

export interface EmptyStateProps {
  icon: IconSvgElement
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  inset?: boolean
  className?: string
}

/** Neutral "nothing here yet" surface. */
export function EmptyState({ icon, ...rest }: EmptyStateProps) {
  return <StatusPanel icon={icon} tone="default" {...rest} />
}

export interface ErrorStateProps {
  title?: ReactNode
  description?: ReactNode
  onRetry?: () => void
  retryLabel?: ReactNode
  icon?: IconSvgElement
  inset?: boolean
  className?: string
}

/** Failure surface with an optional retry button. */
export function ErrorState({
  title = "加载失败",
  description = "请稍后重试。",
  onRetry,
  retryLabel = "重试",
  icon = AlertCircleIcon,
  inset,
  className,
}: ErrorStateProps) {
  return (
    <StatusPanel
      icon={icon}
      tone="destructive"
      title={title}
      description={description}
      inset={inset}
      className={className}
      action={
        onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <HugeiconsIcon
              icon={RefreshIcon}
              data-icon="inline-start"
              strokeWidth={1.8}
            />
            {retryLabel}
          </Button>
        )
      }
    />
  )
}
