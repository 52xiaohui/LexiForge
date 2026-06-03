import type { ReactNode } from "react"

import { AlertCircleIcon, RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type StatusTone = "default" | "destructive"

const toneStyles: Record<
  StatusTone,
  { card: string; halo: string; icon: string; eyebrow: string }
> = {
  default: {
    card: "ring-foreground/10",
    halo: "from-foreground/[0.06]",
    icon: "bg-muted text-foreground ring-foreground/10",
    eyebrow: "text-muted-foreground",
  },
  destructive: {
    card: "ring-destructive/20",
    halo: "from-destructive/10",
    icon: "bg-destructive/10 text-destructive ring-destructive/20",
    eyebrow: "text-destructive",
  },
}

export interface StatusPanelProps {
  icon: IconSvgElement
  title: ReactNode
  description?: ReactNode
  /** Small label above the title (e.g. "出错了", "空空如也"). */
  eyebrow?: ReactNode
  tone?: StatusTone
  /** Center within a tall min-height block (full-page surfaces). Default true. */
  inset?: boolean
  /** Action slot rendered under the description (buttons, links). */
  action?: ReactNode
  className?: string
}

/**
 * Centered icon + title + description + action surface shared by empty, error
 * and not-found states. Renders on a soft card so the whole app speaks the same
 * visual language for "there's nothing (or something wrong) to show here".
 */
export function StatusPanel({
  icon,
  title,
  description,
  eyebrow,
  tone = "default",
  inset = true,
  action,
  className,
}: StatusPanelProps) {
  const styles = toneStyles[tone]
  return (
    <div
      className={cn(
        "grid place-items-center px-6",
        inset && "min-h-[60vh]",
        className,
      )}
    >
      <div
        className={cn(
          "relative w-full max-w-sm overflow-hidden rounded-3xl bg-card px-8 py-10 text-center ring-1 shadow-sm",
          styles.card,
        )}
      >
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b to-transparent",
            styles.halo,
          )}
        />
        <div className="relative">
          <div
            className={cn(
              "mx-auto grid size-14 place-items-center rounded-2xl ring-1 ring-inset",
              styles.icon,
            )}
          >
            <HugeiconsIcon icon={icon} size={24} strokeWidth={1.8} />
          </div>
          {eyebrow && (
            <div
              className={cn(
                "mt-5 text-xs font-medium tracking-wide",
                styles.eyebrow,
              )}
            >
              {eyebrow}
            </div>
          )}
          <h2
            className={cn(
              "font-heading text-xl font-semibold tracking-tight text-balance",
              eyebrow ? "mt-1" : "mt-5",
            )}
          >
            {title}
          </h2>
          {description && (
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-pretty text-muted-foreground">
              {description}
            </p>
          )}
          {action && (
            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
              {action}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export interface EmptyStateProps {
  icon: IconSvgElement
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
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
  eyebrow?: ReactNode
  onRetry?: () => void
  retryLabel?: ReactNode
  /** Optional extra action rendered next to retry (e.g. a "go home" link). */
  secondaryAction?: ReactNode
  icon?: IconSvgElement
  inset?: boolean
  className?: string
}

/** Failure surface with an optional retry button. */
export function ErrorState({
  title = "加载失败",
  description = "请稍后重试。",
  eyebrow = "出错了",
  onRetry,
  retryLabel = "重试",
  secondaryAction,
  icon = AlertCircleIcon,
  inset,
  className,
}: ErrorStateProps) {
  const hasAction = Boolean(onRetry) || Boolean(secondaryAction)
  return (
    <StatusPanel
      icon={icon}
      tone="destructive"
      eyebrow={eyebrow}
      title={title}
      description={description}
      inset={inset}
      className={className}
      action={
        hasAction ? (
          <>
            {onRetry && (
              <Button onClick={onRetry}>
                <HugeiconsIcon
                  icon={RefreshIcon}
                  data-icon="inline-start"
                  strokeWidth={1.8}
                />
                {retryLabel}
              </Button>
            )}
            {secondaryAction}
          </>
        ) : undefined
      }
    />
  )
}
