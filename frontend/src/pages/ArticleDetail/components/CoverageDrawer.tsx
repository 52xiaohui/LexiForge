import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  EyeIcon,
  VolumeHighIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { ArticleDetail, ArticleWord, VocabWord } from "@/types/api"

export interface CoverageDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  article: ArticleDetail
  wordIndex: Map<string, VocabWord>
  onScrollTo: (wordId: string) => void
  onMaster: (wordId: string, spelling: string) => void
  onRecognize: (wordId: string, recognized: boolean) => void
  onSpeak: (text: string) => void
}

/**
 * Floating drawer listing the article's target words. Tapping a row jumps to
 * the word in the article; trailing actions speak / mark recognized / mark
 * mastered. Coverage % already lives in the article header, so it is not
 * repeated here.
 */
export function CoverageDrawer({
  open,
  onOpenChange,
  article,
  wordIndex,
  onScrollTo,
  onMaster,
  onRecognize,
  onSpeak,
}: CoverageDrawerProps) {
  const covered = article.article_words.filter((w) => w.is_covered)
  const uncovered = article.article_words.filter((w) => !w.is_covered)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-md overflow-y-auto p-0"
      >
        <SheetHeader className="gap-1 border-b border-border/60">
          <SheetTitle>本文目标词</SheetTitle>
          <SheetDescription>
            命中 {article.covered_word_count}/{article.target_word_count}
            {uncovered.length > 0 && ` · ${uncovered.length} 个没写进文章`}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-6 py-5">
          {covered.length > 0 && (
            <ul className="space-y-1.5 text-sm">
              {covered.map((w) => (
                <WordListRow
                  key={w.word_id}
                  aw={w}
                  word={wordIndex.get(w.word_id) ?? null}
                  onScrollTo={() => {
                    onScrollTo(w.word_id)
                    onOpenChange(false)
                  }}
                  onMaster={() => onMaster(w.word_id, w.spelling)}
                  onRecognize={(value) => onRecognize(w.word_id, value)}
                  onSpeak={() => onSpeak(w.spelling)}
                />
              ))}
            </ul>
          )}

          {uncovered.length > 0 && (
            <section className="space-y-2">
              <Separator />
              <SectionLabel>
                <span className="inline-flex items-center gap-1">
                  <HugeiconsIcon
                    icon={AlertCircleIcon}
                    size={12}
                    strokeWidth={1.8}
                  />
                  没写进文章的目标词
                </span>
              </SectionLabel>
              <ul className="space-y-1 text-sm">
                {uncovered.map((w) => (
                  <li
                    key={`${w.word_id}-${w.spelling}`}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="font-heading font-medium">{w.spelling}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {w.translation}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                重新生成一次或降低目标词数通常能提高命中。
              </p>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SectionLabel({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </div>
  )
}

interface WordListRowProps {
  aw: ArticleWord
  word: VocabWord | null
  onScrollTo: () => void
  onMaster: () => void
  onRecognize: (recognized: boolean) => void
  onSpeak: () => void
}

function WordListRow({
  aw,
  word,
  onScrollTo,
  onMaster,
  onRecognize,
  onSpeak,
}: WordListRowProps) {
  const tier = word?.mastered
    ? "mastered"
    : word?.recognized
      ? "recognized"
      : "open"
  return (
    <li className="group/item flex items-center justify-between gap-3 rounded-lg px-1 py-1 hover:bg-muted/40">
      <button
        type="button"
        onClick={onScrollTo}
        className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
      >
        <span className="font-heading text-sm font-medium">{aw.spelling}</span>
        <span className="truncate text-xs text-muted-foreground">
          {aw.translation}
        </span>
        {tier === "mastered" && (
          <Badge
            variant="outline"
            className="border-emerald-500/30 text-[10px] text-emerald-600 dark:text-emerald-400"
          >
            已掌握
          </Badge>
        )}
        {tier === "recognized" && (
          <Badge
            variant="outline"
            className="border-sky-500/30 text-[10px] text-sky-600 dark:text-sky-400"
          >
            认得
          </Badge>
        )}
      </button>
      <div className="flex items-center gap-1 transition-opacity group-hover/item:opacity-100 focus-within:opacity-100 [@media(hover:hover)]:opacity-0">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`朗读 ${aw.spelling}`}
          onClick={onSpeak}
        >
          <HugeiconsIcon icon={VolumeHighIcon} strokeWidth={1.8} />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={
            word?.recognized ? `取消认得 ${aw.spelling}` : `认得 ${aw.spelling}`
          }
          onClick={() => onRecognize(!word?.recognized)}
        >
          <HugeiconsIcon icon={EyeIcon} strokeWidth={1.8} />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`标记 ${aw.spelling} 已掌握`}
          disabled={word?.mastered}
          onClick={onMaster}
        >
          <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={1.8} />
        </Button>
      </div>
    </li>
  )
}
