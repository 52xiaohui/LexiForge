import {
  BookmarkAdd02Icon,
  CheckmarkCircle02Icon,
  EyeIcon,
  VolumeHighIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router-dom"

import { LastResponseBadge } from "@/components/common/LastResponseBadge"
import { Badge } from "@/components/ui/badge"
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
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { ArticleWord, VocabWord } from "@/types/api"

import { targetDomId } from "../parsing"

type Tier = "mastered" | "recognized" | "weak-high" | "weak-mid" | "weak-low"

/**
 * Pick a visual tier for the highlight. Mastered/recognized win because they
 * carry user signal; otherwise we shade by weak_score so the eye spends more
 * energy on the words that still need it.
 */
function classifyTier(word: VocabWord | null): Tier {
  if (!word) return "weak-mid"
  if (word.mastered) return "mastered"
  if (word.recognized) return "recognized"
  if (word.weak_score >= 130) return "weak-high"
  if (word.weak_score >= 95) return "weak-mid"
  return "weak-low"
}

const TIER_CLASS: Record<Tier, string> = {
  // Mastered: just an underline, no fill — the word should fade into the body.
  mastered:
    "underline decoration-emerald-500/50 underline-offset-4 decoration-[1.5px] hover:decoration-emerald-500",
  // Recognized: a soft tint and dotted underline.
  recognized:
    "rounded-md bg-sky-200/30 px-0.5 underline decoration-sky-500/50 decoration-dotted underline-offset-4 hover:bg-sky-200/60 dark:bg-sky-400/15 dark:hover:bg-sky-400/25",
  // High weak: full-fat amber highlight (the legacy default).
  "weak-high":
    "rounded-md bg-amber-300/80 px-0.5 ring-1 ring-amber-500/50 hover:bg-amber-300 dark:bg-amber-400/35 dark:hover:bg-amber-400/55",
  // Mid weak: lighter amber.
  "weak-mid":
    "rounded-md bg-amber-200/55 px-0.5 ring-1 ring-amber-400/30 hover:bg-amber-200/85 dark:bg-amber-400/20 dark:hover:bg-amber-400/35",
  // Low weak: dotted underline only.
  "weak-low":
    "underline decoration-amber-500/60 decoration-dotted underline-offset-4 hover:decoration-amber-500",
}

export interface TargetMarkProps {
  articleId: string
  /** Article-side mark (carries spelling + offsets). */
  articleWord: ArticleWord
  /** Vocab-side word, if we have it (popover meta). */
  word: VocabWord | null
  challengeMode: boolean
  onMaster: (wordId: string, spelling: string) => void
  onRecognize: (wordId: string, recognized: boolean) => void
  onSpeak: (text: string) => void
  children: React.ReactNode
}

export function TargetMark({
  articleId,
  articleWord,
  word,
  challengeMode,
  onMaster,
  onRecognize,
  onSpeak,
  children,
}: TargetMarkProps) {
  const tier = classifyTier(word)
  // In challenge mode we reveal the translation only after the user explicitly
  // taps "show". A fresh popover open resets the flag.
  const [revealed, setRevealed] = useState(!challengeMode)

  return (
    <Popover
      onOpenChange={(open) => {
        if (!open) setRevealed(!challengeMode)
      }}
    >
      <PopoverTrigger asChild>
        <mark
          id={targetDomId(articleId, articleWord.word_id)}
          tabIndex={0}
          aria-label={`目标词 ${articleWord.spelling}`}
          data-slot="target-mark"
          data-tier={tier}
          className={cn(
            "cursor-pointer rounded-md font-medium text-foreground outline-offset-2 transition duration-150 focus-visible:outline-2 focus-visible:outline-ring",
            TIER_CLASS[tier]
          )}
        >
          {children}
        </mark>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[70vh] w-80 space-y-3 overflow-y-auto"
      >
        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="font-heading text-base font-semibold">
                {articleWord.spelling}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`朗读 ${articleWord.spelling}`}
                className="translate-y-0.5"
                onClick={() => onSpeak(articleWord.spelling)}
              >
                <HugeiconsIcon icon={VolumeHighIcon} strokeWidth={1.8} />
              </Button>
            </div>
            {word && <LastResponseBadge value={word.last_response} />}
          </div>

          {revealed ? (
            <div className="text-sm text-muted-foreground">
              {articleWord.translation}
            </div>
          ) : (
            <ChallengeReveal onReveal={() => setRevealed(true)} />
          )}
        </div>

        {revealed && word?.example_sentence && (
          <blockquote className="border-l-2 border-border/60 pl-3 text-xs leading-relaxed text-muted-foreground italic">
            {word.example_sentence}
          </blockquote>
        )}

        {revealed && word?.synonyms && word.synonyms.length > 0 && (
          <MetaRow label="近义词">
            <div className="flex flex-wrap gap-1">
              {word.synonyms.map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="text-[11px] font-normal"
                >
                  {s}
                </Badge>
              ))}
            </div>
          </MetaRow>
        )}

        {revealed && word?.root_note && (
          <MetaRow label="词根">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {word.root_note}
            </p>
          </MetaRow>
        )}

        {word && (
          <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
            <span>
              weak{" "}
              <span className="font-heading text-foreground tabular-nums">
                {word.weak_score}
              </span>
            </span>
            <span>练习 {word.study_count} 次</span>
            {word.recently_covered_count != null &&
              word.recently_covered_count > 1 && (
                <span>近期覆盖 {word.recently_covered_count} 次</span>
              )}
          </div>
        )}

        {word?.related_article_ids && word.related_article_ids.length > 1 && (
          <RelatedArticles
            currentArticleId={articleId}
            relatedIds={word.related_article_ids}
          />
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant={word?.recognized ? "secondary" : "outline"}
              size="sm"
              className="flex-1"
              aria-pressed={Boolean(word?.recognized)}
              onClick={() =>
                onRecognize(articleWord.word_id, !word?.recognized)
              }
            >
              <HugeiconsIcon
                icon={EyeIcon}
                data-icon="inline-start"
                strokeWidth={1.8}
              />
              {word?.recognized ? "认得了" : "在文中认出"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={word?.mastered}
              onClick={() =>
                onMaster(articleWord.word_id, articleWord.spelling)
              }
            >
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                data-icon="inline-start"
                strokeWidth={1.8}
              />
              {word?.mastered ? "已掌握" : "掌握"}
            </Button>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="加入笔记本 (v1)"
                disabled
              >
                <HugeiconsIcon
                  icon={BookmarkAdd02Icon}
                  data-icon="inline-start"
                  strokeWidth={1.8}
                />
                笔记本
              </Button>
            </TooltipTrigger>
            <TooltipContent>v1 开放，敬请期待</TooltipContent>
          </Tooltip>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ChallengeReveal({ onReveal }: { onReveal: () => void }) {
  return (
    <div className="rounded-xl bg-muted/50 p-2 text-xs leading-relaxed text-muted-foreground">
      <div className="mb-2 italic">先猜一下意思——</div>
      <Button
        variant="outline"
        size="xs"
        onClick={onReveal}
        className="text-[11px]"
      >
        <HugeiconsIcon
          icon={EyeIcon}
          data-icon="inline-start"
          strokeWidth={1.8}
        />
        显示翻译
      </Button>
    </div>
  )
}

function MetaRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </div>
      {children}
    </div>
  )
}

interface RelatedArticlesProps {
  currentArticleId: string
  relatedIds: string[]
}

function RelatedArticles({
  currentArticleId,
  relatedIds,
}: RelatedArticlesProps) {
  const { data: articles = [] } = useQuery({
    queryKey: ["articles", "list"],
    queryFn: () => api.listArticles(),
  })
  const others = articles.filter(
    (a) => relatedIds.includes(a.id) && a.id !== currentArticleId
  )
  if (others.length === 0) return null
  return (
    <div className="space-y-1 border-t border-border/60 pt-2">
      <div className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
        也在这些文章里
      </div>
      <ul className="space-y-1">
        {others.slice(0, 3).map((a) => (
          <li key={a.id}>
            <Link
              to={`/articles/${a.id}`}
              className="group flex items-baseline gap-2 text-xs leading-snug"
            >
              <span className="truncate font-medium group-hover:underline">
                {a.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
