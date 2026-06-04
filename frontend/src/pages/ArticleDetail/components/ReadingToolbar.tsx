import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  BookmarkAdd02Icon,
  GlassesIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  type ReadingFontFamily,
  type ReadingFontSize,
  type ReadingTone,
} from "@/hooks/use-reading-prefs"
import { cn } from "@/lib/utils"

import { ReadingPrefsPopover } from "./ReadingPrefsPopover"

/** Thin vertical rule separating functional clusters in the toolbar. */
function ToolbarDivider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border/70" />
}

export interface ReadingToolbarProps {
  // Reading prefs (all forwarded to the popover)
  fontSize: ReadingFontSize
  onFontSize: (size: ReadingFontSize) => void
  fontFamily: ReadingFontFamily
  onFontFamily: (family: ReadingFontFamily) => void
  tone: ReadingTone
  onTone: (tone: ReadingTone) => void
  challengeMode: boolean
  onChallengeMode: (value: boolean) => void
  paragraphFeedback: boolean
  onParagraphFeedback: (value: boolean) => void

  // TTS
  speechSupported: boolean
  speechSpeaking: boolean
  speechPaused: boolean
  onPlay: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onSpeechPrev: () => void
  onSpeechNext: () => void

  // Target navigation
  hasTargets: boolean
  targetIndex: number
  targetCount: number
  onPrevTarget: () => void
  onNextTarget: () => void

  // Drawer / Review opens
  onOpenWordList: () => void
  onOpenReview: () => void
}

/**
 * The desktop toolbar that lives just below the article header. Controls are
 * split into labelled clusters separated by thin rules: playback (TTS) and
 * display prefs on the left, target-word navigation and drawer triggers on the
 * right. Reading prefs live behind a single popover so the bar stays one line.
 */
export function ReadingToolbar(props: ReadingToolbarProps) {
  const {
    speechSupported,
    speechSpeaking,
    speechPaused,
    onPlay,
    onPause,
    onResume,
    onStop,
    onSpeechPrev,
    onSpeechNext,
    hasTargets,
    targetIndex,
    targetCount,
    onPrevTarget,
    onNextTarget,
    onOpenWordList,
    onOpenReview,
  } = props

  const playing = speechSpeaking && !speechPaused

  return (
    <div className="hidden flex-wrap items-center gap-1 rounded-2xl border border-border/50 bg-background/55 p-1.5 shadow-sm backdrop-blur supports-backdrop-filter:bg-background/45 sm:flex">
      {speechSupported && (
        <div
          className="flex items-center gap-0.5"
          role="group"
          aria-label="朗读控制"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="上一句"
                disabled={!speechSpeaking}
                onClick={onSpeechPrev}
              >
                <HugeiconsIcon icon={PreviousIcon} strokeWidth={1.8} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>上一句</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={speechSpeaking ? "secondary" : "ghost"}
                size="sm"
                aria-label={
                  playing ? "暂停朗读" : speechPaused ? "继续朗读" : "朗读全文"
                }
                onClick={() => {
                  if (playing) onPause()
                  else if (speechPaused) onResume()
                  else onPlay()
                }}
              >
                <HugeiconsIcon
                  icon={playing ? PauseIcon : PlayIcon}
                  data-icon="inline-start"
                  strokeWidth={1.8}
                />
                {playing ? "暂停" : speechPaused ? "继续" : "朗读"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>逐句朗读 · 当前句会高亮</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="下一句"
                disabled={!speechSpeaking}
                onClick={onSpeechNext}
              >
                <HugeiconsIcon icon={NextIcon} strokeWidth={1.8} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>下一句</TooltipContent>
          </Tooltip>
          {speechSpeaking && (
            <Button
              variant="ghost"
              size="xs"
              className="ms-0.5 text-xs text-muted-foreground"
              onClick={onStop}
            >
              停止
            </Button>
          )}
        </div>
      )}

      {speechSupported && <ToolbarDivider />}
      <ReadingPrefsPopover {...props} />

      <div className="ms-auto flex items-center gap-1">
        {hasTargets && (
          <div className="flex items-center gap-1" role="group" aria-label="目标词导航">
            <span className="text-xs tabular-nums text-muted-foreground">
              目标词 {targetIndex + 1}/{targetCount}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="上一个目标词"
                  onClick={onPrevTarget}
                >
                  <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={1.8} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                上一个 <span className="opacity-60">(P / Shift + ←)</span>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="下一个目标词"
                  onClick={onNextTarget}
                >
                  <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={1.8} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                下一个 <span className="opacity-60">(N / Shift + →)</span>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
        {hasTargets && <ToolbarDivider />}
        <div className="flex items-center gap-1" role="group" aria-label="词表与回顾">
          <Button
            variant="ghost"
            size="sm"
            aria-label="打开词表抽屉"
            onClick={onOpenWordList}
          >
            <HugeiconsIcon
              icon={BookmarkAdd02Icon}
              data-icon="inline-start"
              strokeWidth={1.8}
            />
            <span className="hidden md:inline">词表</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="回顾这篇"
            onClick={onOpenReview}
          >
            <HugeiconsIcon
              icon={GlassesIcon}
              data-icon="inline-start"
              strokeWidth={1.8}
            />
            <span className="hidden md:inline">回顾</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Mobile bottom-fixed toolbar. Same actions as the desktop bar but spread
 * across the bottom safe-area for thumb reach. Sticks above the iOS gesture
 * bar via `env(safe-area-inset-bottom)`.
 */
export function MobileReadingBar(
  props: Pick<
    ReadingToolbarProps,
    | "speechSupported"
    | "speechSpeaking"
    | "speechPaused"
    | "onPlay"
    | "onPause"
    | "onResume"
    | "onStop"
    | "onPrevTarget"
    | "onNextTarget"
    | "hasTargets"
    | "onOpenWordList"
    | "onOpenReview"
  > &
    Pick<
      ReadingToolbarProps,
      | "fontSize"
      | "onFontSize"
      | "fontFamily"
      | "onFontFamily"
      | "tone"
      | "onTone"
      | "challengeMode"
      | "onChallengeMode"
      | "paragraphFeedback"
      | "onParagraphFeedback"
    >,
) {
  const {
    speechSupported,
    speechSpeaking,
    speechPaused,
    onPlay,
    onPause,
    onResume,
    hasTargets,
    onPrevTarget,
    onNextTarget,
    onOpenWordList,
    onOpenReview,
  } = props
  const playing = speechSpeaking && !speechPaused

  return (
    <div
      className={cn(
        "fixed inset-x-2 z-30 flex items-center justify-between gap-1 rounded-2xl border border-border/60 bg-background/92 p-1 shadow-lg backdrop-blur sm:hidden",
      )}
      style={{ bottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      role="toolbar"
      aria-label="阅读快捷工具"
    >
      {speechSupported && (
        <Button
          variant={playing ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label={
            playing ? "暂停朗读" : speechPaused ? "继续朗读" : "朗读全文"
          }
          onClick={() => {
            if (playing) onPause()
            else if (speechPaused) onResume()
            else onPlay()
          }}
        >
          <HugeiconsIcon
            icon={playing ? PauseIcon : PlayIcon}
            strokeWidth={1.8}
          />
        </Button>
      )}
      <ReadingPrefsPopover {...props} />
      <div className="ms-auto flex items-center gap-0.5">
        {hasTargets && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="上一个目标词"
              onClick={onPrevTarget}
            >
              <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={1.8} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="下一个目标词"
              onClick={onNextTarget}
            >
              <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={1.8} />
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="词表"
          onClick={onOpenWordList}
        >
          <HugeiconsIcon icon={BookmarkAdd02Icon} strokeWidth={1.8} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="回顾"
          onClick={onOpenReview}
        >
          <HugeiconsIcon icon={GlassesIcon} strokeWidth={1.8} />
        </Button>
      </div>
    </div>
  )
}
