import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  EyeIcon,
  RefreshIcon,
  VolumeHighIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useState } from "react"

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

import type { Sentence } from "../parsing"

export interface ReviewSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  article: ArticleDetail
  /** Pre-flattened sentence list from `parseArticle`. */
  sentences: Sentence[]
  wordIndex: Map<string, VocabWord>
  onMaster: (wordId: string, spelling: string) => void
  onRecognize: (wordId: string, recognized: boolean) => void
  onSpeak: (text: string) => void
}

/**
 * Condensed review of an article: a list of every sentence containing a target
 * word, plus a mini-flashcard deck for the article's covered targets. Both
 * tabs share the same drawer to keep the post-reading flow on one surface.
 */
export function ReviewSheet({
  open,
  onOpenChange,
  article,
  sentences,
  wordIndex,
  onMaster,
  onRecognize,
  onSpeak,
}: ReviewSheetProps) {
  const [tab, setTab] = useState<"contexts" | "cards">("contexts")

  const sentencesWithTargets = useMemo(
    () => sentences.filter((s) => s.segments.some((seg) => seg.kind === "target")),
    [sentences],
  )

  const cards = useMemo(
    () => article.article_words.filter((w) => w.is_covered),
    [article],
  )

  // Reset flashcard cursor whenever a fresh review opens, using render-time
  // state reset so we avoid a setState-in-effect cascade.
  const [cardIdx, setCardIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [openSnapshot, setOpenSnapshot] = useState({
    open,
    articleId: article.id,
  })
  if (
    openSnapshot.open !== open ||
    openSnapshot.articleId !== article.id
  ) {
    setOpenSnapshot({ open, articleId: article.id })
    if (open) {
      setCardIdx(0)
      setFlipped(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-lg overflow-y-auto p-0"
      >
        <SheetHeader className="gap-2 border-b border-border/60">
          <SheetTitle>回顾 · {article.title}</SheetTitle>
          <SheetDescription>
            读完一篇之后再过一遍最值的——只看含目标词的句子，再用闪卡逐个回忆。
          </SheetDescription>
          <div className="flex gap-1 pt-2">
            <TabButton
              active={tab === "contexts"}
              onClick={() => setTab("contexts")}
            >
              语境句 ({sentencesWithTargets.length})
            </TabButton>
            <TabButton active={tab === "cards"} onClick={() => setTab("cards")}>
              闪卡 ({cards.length})
            </TabButton>
          </div>
        </SheetHeader>

        <div className="px-6 py-5">
          {tab === "contexts" ? (
            <ContextList
              sentences={sentencesWithTargets}
              wordIndex={wordIndex}
              onSpeak={onSpeak}
            />
          ) : (
            <FlashcardDeck
              cards={cards}
              wordIndex={wordIndex}
              cardIdx={cardIdx}
              flipped={flipped}
              onPrev={() => {
                setCardIdx((i) => Math.max(0, i - 1))
                setFlipped(false)
              }}
              onNext={() => {
                setCardIdx((i) => Math.min(cards.length - 1, i + 1))
                setFlipped(false)
              }}
              onFlip={() => setFlipped((f) => !f)}
              onMaster={onMaster}
              onRecognize={onRecognize}
              onSpeak={onSpeak}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function ContextList({
  sentences,
  wordIndex,
  onSpeak,
}: {
  sentences: Sentence[]
  wordIndex: Map<string, VocabWord>
  onSpeak: (text: string) => void
}) {
  if (sentences.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        这篇没有命中的目标词，AI 这次发挥不太行。
      </div>
    )
  }
  return (
    <ul className="space-y-3">
      {sentences.map((s) => (
        <li
          key={s.globalIdx}
          className="rounded-2xl bg-muted/40 p-3 text-sm leading-relaxed"
        >
          <p className="m-0">
            {s.segments.map((seg, i) =>
              seg.kind === "target" && seg.word ? (
                <mark
                  key={i}
                  className="rounded-md bg-amber-300/80 px-0.5 font-medium text-amber-950 dark:bg-amber-400/35 dark:text-amber-50"
                >
                  {seg.text}
                </mark>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </p>
          <div className="mt-1.5 flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {s.segments
                .filter((seg) => seg.kind === "target" && seg.word)
                .map((seg, i) => {
                  const w = wordIndex.get(seg.word!.word_id) ?? null
                  return (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      <span className="font-heading">{seg.word!.spelling}</span>
                      <span className="ms-1 text-muted-foreground">
                        {seg.word!.translation}
                      </span>
                      {w?.mastered && (
                        <span className="ms-1 text-emerald-600 dark:text-emerald-400">
                          ·已掌握
                        </span>
                      )}
                    </Badge>
                  )
                })}
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="朗读这一句"
              onClick={() => onSpeak(s.text)}
            >
              <HugeiconsIcon icon={VolumeHighIcon} strokeWidth={1.8} />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}

interface FlashcardDeckProps {
  cards: ArticleWord[]
  wordIndex: Map<string, VocabWord>
  cardIdx: number
  flipped: boolean
  onPrev: () => void
  onNext: () => void
  onFlip: () => void
  onMaster: (wordId: string, spelling: string) => void
  onRecognize: (wordId: string, recognized: boolean) => void
  onSpeak: (text: string) => void
}

function FlashcardDeck({
  cards,
  wordIndex,
  cardIdx,
  flipped,
  onPrev,
  onNext,
  onFlip,
  onMaster,
  onRecognize,
  onSpeak,
}: FlashcardDeckProps) {
  if (cards.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        没有命中目标词，无法生成闪卡。
      </div>
    )
  }
  const aw = cards[cardIdx]!
  const word = wordIndex.get(aw.word_id) ?? null
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {cardIdx + 1} / {cards.length}
        </span>
        <Button
          variant="ghost"
          size="xs"
          onClick={onFlip}
          aria-label="翻转卡片"
        >
          <HugeiconsIcon
            icon={RefreshIcon}
            data-icon="inline-start"
            strokeWidth={1.8}
          />
          翻面
        </Button>
      </div>

      <button
        type="button"
        onClick={onFlip}
        className={cn(
          "flex min-h-44 w-full flex-col items-center justify-center rounded-3xl border border-border/70 p-6 text-center transition-colors",
          flipped ? "bg-card" : "bg-muted/40",
        )}
      >
        {!flipped ? (
          <>
            <span className="font-heading text-3xl font-semibold tracking-tight">
              {aw.spelling}
            </span>
            <span className="mt-2 text-xs text-muted-foreground italic">
              先猜一下意思 · 点击翻面
            </span>
          </>
        ) : (
          <>
            <span className="font-heading text-2xl font-medium">
              {aw.translation}
            </span>
            {word?.example_sentence && (
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground italic">
                {word.example_sentence}
              </p>
            )}
          </>
        )}
      </button>

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPrev}
          disabled={cardIdx === 0}
        >
          <HugeiconsIcon
            icon={ArrowLeft01Icon}
            data-icon="inline-start"
            strokeWidth={1.8}
          />
          上一张
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`朗读 ${aw.spelling}`}
            onClick={() => onSpeak(aw.spelling)}
          >
            <HugeiconsIcon icon={VolumeHighIcon} strokeWidth={1.8} />
          </Button>
          <Button
            variant={word?.recognized ? "secondary" : "outline"}
            size="sm"
            aria-pressed={Boolean(word?.recognized)}
            onClick={() => onRecognize(aw.word_id, !word?.recognized)}
          >
            <HugeiconsIcon
              icon={EyeIcon}
              data-icon="inline-start"
              strokeWidth={1.8}
            />
            {word?.recognized ? "认得" : "记下"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={word?.mastered}
            onClick={() => onMaster(aw.word_id, aw.spelling)}
          >
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              data-icon="inline-start"
              strokeWidth={1.8}
            />
            {word?.mastered ? "已掌握" : "掌握"}
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onNext}
          disabled={cardIdx >= cards.length - 1}
        >
          下一张
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            data-icon="inline-end"
            strokeWidth={1.8}
          />
        </Button>
      </div>

      <Separator />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        提示：先盖住翻译猜一下，再翻面。"认得"只是这一次记住，"掌握"会把词从薄弱词移除。
      </p>
    </div>
  )
}
