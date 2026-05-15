import {
  CheckmarkCircle02Icon,
  TextFontIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import {
  FONT_FAMILY_LABELS,
  FONT_SIZE_LABELS,
  FONT_SIZE_ORDER,
  TONE_LABELS,
  type ReadingFontFamily,
  type ReadingFontSize,
  type ReadingTone,
} from "@/hooks/use-reading-prefs"
import { cn } from "@/lib/utils"

export interface ReadingPrefsPopoverProps {
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
}

/**
 * Compact "Aa" popover that consolidates every reading-surface tweak — font
 * size, font family, page tint, challenge mode, and the per-paragraph
 * self-assessment toggle. Lives in the toolbar so the article body stays
 * uncluttered while still offering tactile control.
 */
export function ReadingPrefsPopover({
  fontSize,
  onFontSize,
  fontFamily,
  onFontFamily,
  tone,
  onTone,
  challengeMode,
  onChallengeMode,
  paragraphFeedback,
  onParagraphFeedback,
}: ReadingPrefsPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="阅读偏好">
          <HugeiconsIcon
            icon={TextFontIcon}
            data-icon="inline-start"
            strokeWidth={1.8}
          />
          <span className="hidden sm:inline">
            阅读 · {FONT_SIZE_LABELS[fontSize].split("·")[1]}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-3">
        <Section label="字号">
          <div className="grid grid-cols-4 gap-1">
            {FONT_SIZE_ORDER.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onFontSize(size)}
                aria-pressed={fontSize === size}
                className={cn(
                  "rounded-xl px-2 py-1.5 text-xs transition-colors",
                  fontSize === size
                    ? "bg-foreground text-background"
                    : "hover:bg-muted",
                )}
              >
                {FONT_SIZE_LABELS[size]}
              </button>
            ))}
          </div>
        </Section>

        <Section label="字体">
          <div className="grid grid-cols-2 gap-1">
            {(Object.keys(FONT_FAMILY_LABELS) as ReadingFontFamily[]).map(
              (f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onFontFamily(f)}
                  aria-pressed={fontFamily === f}
                  className={cn(
                    "rounded-xl px-2 py-1.5 text-xs transition-colors",
                    fontFamily === f
                      ? "bg-foreground text-background"
                      : "hover:bg-muted",
                    f === "serif"
                      ? "[font-family:var(--font-reading-serif)]"
                      : "font-sans",
                  )}
                >
                  {FONT_FAMILY_LABELS[f]}
                </button>
              ),
            )}
          </div>
        </Section>

        <Section label="纸面">
          <div className="grid grid-cols-2 gap-1">
            {(Object.keys(TONE_LABELS) as ReadingTone[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTone(t)}
                aria-pressed={tone === t}
                className={cn(
                  "rounded-xl px-2 py-1.5 text-xs transition-colors",
                  tone === t
                    ? "bg-foreground text-background"
                    : "hover:bg-muted",
                )}
              >
                {TONE_LABELS[t]}
              </button>
            ))}
          </div>
        </Section>

        <Separator />

        <ToggleRow
          label="挑战模式"
          hint="先猜词义，点开后才看翻译"
          value={challengeMode}
          onChange={onChallengeMode}
        />
        <ToggleRow
          label="段落自评"
          hint="段尾显示 ✓ / ?"
          value={paragraphFeedback}
          onChange={onParagraphFeedback}
        />
      </PopoverContent>
    </Popover>
  )
}

function Section({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </div>
      {children}
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        "flex w-full items-center justify-between rounded-xl px-2 py-2 text-left transition-colors",
        "hover:bg-muted",
      )}
    >
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      </div>
      <span
        className={cn(
          "ms-3 flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
          value
            ? "bg-foreground text-background"
            : "bg-muted text-muted-foreground",
        )}
      >
        {value && (
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            size={14}
            strokeWidth={2}
          />
        )}
      </span>
    </button>
  )
}
