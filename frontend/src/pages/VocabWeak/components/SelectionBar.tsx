import { AlertCircleIcon, SparklesIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { FloatingActionBar } from "@/components/common/FloatingActionBar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function SelectionBar({
  selectedCount,
  maxSelection,
  onClear,
  onGenerate,
}: {
  selectedCount: number
  maxSelection: number
  onClear: () => void
  onGenerate: () => void
}) {
  if (selectedCount === 0) return null

  const overLimit = selectedCount > maxSelection

  return (
    <FloatingActionBar
      tone={overLimit ? "destructive" : "default"}
      // Sit above the mobile bottom tab bar; desktop has no tab bar.
      className="bottom-14 lg:bottom-0"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <HugeiconsIcon
          icon={overLimit ? AlertCircleIcon : SparklesIcon}
          size={18}
          strokeWidth={1.8}
          className={cn(overLimit && "text-destructive")}
        />
        <span className="truncate">
          已勾选 <strong className="tabular-nums">{selectedCount}</strong> 个词
          {overLimit && (
            <span className="text-destructive">
              {" "}
              · 超过单篇上限 {maxSelection}，请拆分成多篇
            </span>
          )}
        </span>
      </div>
      <Button variant="ghost" size="sm" onClick={onClear}>
        清空
      </Button>
      <Button size="sm" onClick={onGenerate} disabled={overLimit}>
        <HugeiconsIcon
          icon={SparklesIcon}
          data-icon="inline-start"
          strokeWidth={1.8}
        />
        从勾选生成
      </Button>
    </FloatingActionBar>
  )
}
