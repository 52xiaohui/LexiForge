import { memo, type ReactNode } from "react"

import { LastResponseBadge } from "@/components/common/LastResponseBadge"
import { MasteryMeter } from "@/components/common/MasteryMeter"
import { StickingBadge } from "@/components/common/StickingBadge"
import { WeakScoreMeter } from "@/components/common/WeakScoreMeter"
import { hasStickingTag } from "@/lib/vocab-tags"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDateShort } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import type { VocabWord } from "@/types/api"

export type VocabMetric = "mastery" | "weak"

// ---------------------------------------------------------------------------
// Shared meta strip (badges + study count + next review)
// ---------------------------------------------------------------------------

function WordMetaStrip({
  word,
  className,
}: {
  word: VocabWord
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-[11px]",
        className
      )}
    >
      <LastResponseBadge value={word.last_response} />
      {hasStickingTag(word.tags) && <StickingBadge />}
      <span className="text-muted-foreground">
        练习 {word.study_count} 次
      </span>
      {word.next_study_date && (
        <>
          <span aria-hidden className="text-muted-foreground">
            ·
          </span>
          <span className="text-muted-foreground">
            下次 {formatDateShort(word.next_study_date)}
          </span>
        </>
      )}
    </div>
  )
}

function MetricCompact({
  word,
  metric,
}: {
  word: VocabWord
  metric: VocabMetric
}) {
  if (metric === "weak") {
    return (
      <div className="flex items-baseline gap-1.5 text-xs text-muted-foreground tabular-nums">
        <WeakScoreMeter score={word.weak_score} variant="compact" />
        <span>weak</span>
      </div>
    )
  }
  return (
    <div className="flex items-baseline gap-1.5 text-xs text-muted-foreground tabular-nums">
      <MasteryMeter score={word.mastery_score} variant="compact" />
      <span>掌握</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mobile card (browse or selectable)
// ---------------------------------------------------------------------------

export interface VocabWordCardProps {
  word: VocabWord
  metric: VocabMetric
  selected?: boolean
  onToggle?: (wordId: string, next: boolean) => void
  actions?: ReactNode
  className?: string
}

export const VocabWordCard = memo(function VocabWordCard({
  word,
  metric,
  selected,
  onToggle,
  actions,
  className,
}: VocabWordCardProps) {
  const selectable = Boolean(onToggle)

  const body = (
    <>
      {selectable && (
        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            aria-label={`选择 ${word.spelling}`}
            checked={selected}
            onCheckedChange={(v) => onToggle?.(word.id, v === true)}
          />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="font-heading text-base font-medium tracking-tight">
            {word.spelling}
          </div>
          <MetricCompact word={word} metric={metric} />
        </div>
        <div className="truncate text-sm text-muted-foreground">
          {word.translation}
        </div>
        <WordMetaStrip word={word} />
      </div>
      {actions && (
        <div className="self-start" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </>
  )

  if (!selectable) {
    return <div className={cn("bg-card p-4", className)}>{body}</div>
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`选择 ${word.spelling}，${word.translation}`}
      onClick={() => onToggle?.(word.id, !selected)}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault()
          onToggle?.(word.id, !selected)
        }
      }}
      className={cn(
        "flex gap-3 p-4 transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:-outline-offset-2 focus-visible:outline-none",
        selected ? "bg-muted/60" : "bg-card hover:bg-muted/30",
        className
      )}
    >
      {body}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Card list shell
// ---------------------------------------------------------------------------

export function VocabCardList({
  words,
  metric,
  emptyLabel = "没有匹配的单词。",
  selectedIds,
  onToggle,
  renderActions,
}: {
  words: VocabWord[]
  metric: VocabMetric
  emptyLabel?: string
  selectedIds?: Set<string>
  onToggle?: (wordId: string, next: boolean) => void
  renderActions?: (word: VocabWord) => ReactNode
}) {
  if (words.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 py-16 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60">
      {words.map((word) => (
        <VocabWordCard
          key={word.id}
          word={word}
          metric={metric}
          selected={selectedIds?.has(word.id)}
          onToggle={onToggle}
          actions={renderActions?.(word)}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Desktop table (browse or selectable)
// ---------------------------------------------------------------------------

export interface VocabTableColumnExtras {
  /** Extra header cells after the core columns (before trailing actions). */
  midHeaders?: ReactNode
  /** Render extra cells for a row (e.g. sort-only columns already covered). */
  midCells?: (word: VocabWord) => ReactNode
  /** Trailing header (e.g. empty actions column). */
  trailHeader?: ReactNode
  trailCell?: (word: VocabWord) => ReactNode
}

export interface VocabWordTableProps {
  words: VocabWord[]
  metric: VocabMetric
  emptyLabel?: string
  /** When set, shows a leading checkbox column. */
  selectedIds?: Set<string>
  onToggle?: (wordId: string, next: boolean) => void
  onToggleAllVisible?: (next: boolean) => void
  /** Custom header for the metric column (e.g. sortable button). */
  metricHeader?: ReactNode
  studyHeader?: ReactNode
  extras?: VocabTableColumnExtras
  className?: string
}

export function VocabWordTable({
  words,
  metric,
  emptyLabel = "没有匹配的单词。",
  selectedIds,
  onToggle,
  onToggleAllVisible,
  metricHeader,
  studyHeader,
  extras,
  className,
}: VocabWordTableProps) {
  const selectable = Boolean(onToggle)
  const visibleIds = words.map((w) => w.id)
  const allSelected =
    selectable &&
    words.length > 0 &&
    visibleIds.every((id) => selectedIds?.has(id))
  const someSelected =
    selectable &&
    !allSelected &&
    visibleIds.some((id) => selectedIds?.has(id))

  // Core columns: [check?] spelling translation response metric study tags next [trail?]
  let colSpan = 7
  if (selectable) colSpan += 1
  if (extras?.midHeaders) colSpan += 1 // approximate; mid cells may vary
  if (extras?.trailHeader || extras?.trailCell) colSpan += 1

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/60",
        className
      )}
    >
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            {selectable && (
              <TableHead className="w-10 pl-4">
                <Checkbox
                  aria-label="全选当前已加载"
                  checked={
                    allSelected
                      ? true
                      : someSelected
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={(v) => onToggleAllVisible?.(v === true)}
                />
              </TableHead>
            )}
            <TableHead className={selectable ? undefined : "pl-4"}>
              单词
            </TableHead>
            <TableHead>释义</TableHead>
            <TableHead>反馈</TableHead>
            <TableHead>
              {metricHeader ?? (metric === "weak" ? "weak" : "掌握度")}
            </TableHead>
            <TableHead>{studyHeader ?? "练习次数"}</TableHead>
            {extras?.midHeaders}
            <TableHead>标签</TableHead>
            <TableHead
              className={cn(
                "text-right",
                !extras?.trailCell && !extras?.trailHeader && "pr-4"
              )}
            >
              下次复习
            </TableHead>
            {(extras?.trailHeader || extras?.trailCell) &&
              (extras.trailHeader ?? <TableHead className="w-10 pr-4" />)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {words.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={colSpan}
                className="py-16 text-center text-sm text-muted-foreground"
              >
                {emptyLabel}
              </TableCell>
            </TableRow>
          ) : (
            words.map((word) => (
              <VocabTableRow
                key={word.id}
                word={word}
                metric={metric}
                selected={selectedIds?.has(word.id)}
                selectable={selectable}
                onToggle={onToggle}
                midCells={extras?.midCells}
                trailCell={extras?.trailCell}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

const VocabTableRow = memo(function VocabTableRow({
  word,
  metric,
  selected,
  selectable,
  onToggle,
  midCells,
  trailCell,
}: {
  word: VocabWord
  metric: VocabMetric
  selected?: boolean
  selectable: boolean
  onToggle?: (wordId: string, next: boolean) => void
  midCells?: (word: VocabWord) => ReactNode
  trailCell?: (word: VocabWord) => ReactNode
}) {
  return (
    <TableRow
      data-state={selected ? "selected" : undefined}
      aria-checked={selectable ? selected : undefined}
      role="row"
      className={cn(
        selectable && "cursor-pointer focus-within:bg-muted/40"
      )}
      onClick={
        selectable ? () => onToggle?.(word.id, !selected) : undefined
      }
    >
      {selectable && (
        <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            aria-label={`选择 ${word.spelling}`}
            checked={selected}
            onCheckedChange={(v) => onToggle?.(word.id, v === true)}
          />
        </TableCell>
      )}
      <TableCell className={selectable ? undefined : "pl-4"}>
        <div className="font-heading text-sm font-medium">{word.spelling}</div>
      </TableCell>
      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
        {word.translation}
      </TableCell>
      <TableCell>
        <LastResponseBadge value={word.last_response} />
      </TableCell>
      <TableCell>
        {metric === "weak" ? (
          <WeakScoreMeter score={word.weak_score} />
        ) : (
          <MasteryMeter score={word.mastery_score} />
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground tabular-nums">
        {word.study_count}
      </TableCell>
      {midCells?.(word)}
      <TableCell>
        {hasStickingTag(word.tags) && <StickingBadge />}
      </TableCell>
      <TableCell
        className={cn(
          "text-right text-xs text-muted-foreground tabular-nums",
          !trailCell && "pr-4"
        )}
      >
        {formatDateShort(word.next_study_date)}
      </TableCell>
      {trailCell && (
        <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
          {trailCell(word)}
        </TableCell>
      )}
    </TableRow>
  )
})
