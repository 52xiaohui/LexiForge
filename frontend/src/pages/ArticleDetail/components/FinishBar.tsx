import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Download04Icon,
  GlassesIcon,
  MoreHorizontalIcon,
  RefreshIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "react-router-dom"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export interface FinishBarProps {
  coveredCount: number
  onMasterAll: () => void
  onRegenerate: () => void
  isRegenerating: boolean
  onExport: () => void
  onPracticeWords: () => void
  /**
   * Deep link for the primary “next article” CTA. Prefer carrying topic /
   * difficulty / auto-recommend so the learning loop stays warm.
   */
  nextGenerateTo?: string
}

/**
 * Hierarchy:
 * 1. Primary — generate a *new* article (keeps the learning loop moving).
 * 2. Secondary — regenerate with same params / practice targets.
 * 3. Overflow — export / batch master.
 */
export function FinishBar({
  coveredCount,
  onMasterAll,
  onRegenerate,
  isRegenerating,
  onExport,
  onPracticeWords,
  nextGenerateTo = "/articles/new",
}: FinishBarProps) {
  return (
    <section className="rounded-[1.5rem] border border-border/50 bg-background/55 p-4 shadow-sm backdrop-blur supports-backdrop-filter:bg-background/45 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-heading text-sm font-medium">读完了？继续下一轮</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {coveredCount > 0
              ? `命中 ${coveredCount} 个目标词。生成下一篇把薄弱词继续串起来，或先练这篇的词。`
              : "生成下一篇继续练，或换参数重新生成。"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="default" size="sm">
            <Link to={nextGenerateTo}>
              <HugeiconsIcon
                icon={SparklesIcon}
                data-icon="inline-start"
                strokeWidth={1.8}
              />
              生成下一篇
            </Link>
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isRegenerating}
                className={cn(isRegenerating && "opacity-80")}
              >
                <HugeiconsIcon
                  icon={isRegenerating ? RefreshIcon : RefreshIcon}
                  data-icon="inline-start"
                  strokeWidth={1.8}
                  className={cn(isRegenerating && "animate-spin")}
                />
                {isRegenerating ? "重新生成中…" : "同参数再来"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>使用相同参数重新生成？</AlertDialogTitle>
                <AlertDialogDescription>
                  新文章会作为独立条目保存在历史里，当前这篇不变。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={onRegenerate}>
                  重新生成
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            variant="outline"
            size="sm"
            disabled={coveredCount === 0}
            onClick={onPracticeWords}
          >
            <HugeiconsIcon
              icon={GlassesIcon}
              data-icon="inline-start"
              strokeWidth={1.8}
            />
            练这篇的词
          </Button>

          <Button asChild variant="ghost" size="sm">
            <Link to="/vocab/weak">
              薄弱词
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                data-icon="inline-end"
                strokeWidth={1.8}
              />
            </Link>
          </Button>

          <OverflowMenu
            coveredCount={coveredCount}
            onExport={onExport}
            onMasterAll={onMasterAll}
          />
        </div>
      </div>
    </section>
  )
}

interface OverflowMenuProps {
  coveredCount: number
  onExport: () => void
  onMasterAll: () => void
}

function OverflowMenu({
  coveredCount,
  onExport,
  onMasterAll,
}: OverflowMenuProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="更多操作">
          <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={1.8} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <button
          type="button"
          onClick={onExport}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-muted"
        >
          <HugeiconsIcon icon={Download04Icon} size={16} strokeWidth={1.8} />
          导出 Markdown
        </button>
        <Separator className="my-1" />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={coveredCount === 0}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
            >
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={16}
                strokeWidth={1.8}
              />
              批量标记 {coveredCount} 词已掌握
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认批量标记已掌握？</AlertDialogTitle>
              <AlertDialogDescription>
                这 {coveredCount} 个词会从薄弱词列表消失，下次生成文章也不再优先挑选。
                标记后会弹出撤销提示，可以在几秒内回退。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={onMasterAll}>
                全部标记
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PopoverContent>
    </Popover>
  )
}
