import { SparklesIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ChoiceCard } from "@/components/common/ChoiceCard"
import { FilterChip } from "@/components/common/FilterChip"
import { SectionPanel } from "@/components/common/SectionPanel"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import {
  MAX_TARGET_WORD_COUNT,
  MIN_TARGET_WORD_COUNT,
} from "@/lib/article-generation"
import type { ArticleLength, CefrLevel } from "@/types/api"

const TOPIC_CHIPS: { label: string; value: string }[] = [
  { label: "考研", value: "postgraduate entrance exam style" },
  { label: "四六级", value: "CET college English passage" },
  { label: "雅思", value: "IELTS reading style" },
  { label: "托福", value: "TOEFL reading style" },
  { label: "商务", value: "business communication" },
  { label: "科技", value: "emerging technology" },
  { label: "校园生活", value: "campus life" },
  { label: "旅行", value: "travel and culture" },
  { label: "心理学", value: "popular psychology" },
  { label: "哲学", value: "philosophy and ethics" },
]

const difficulties: { value: CefrLevel; label: string; hint: string }[] = [
  { value: "A2", label: "A2", hint: "初阶" },
  { value: "B1", label: "B1", hint: "中阶" },
  { value: "B2", label: "B2", hint: "中高阶" },
  { value: "C1", label: "C1", hint: "进阶" },
]

const lengths: {
  value: ArticleLength
  label: string
  hint: string
  range: string
}[] = [
  { value: "short", label: "短文", hint: "15–25", range: "≈ 150 字" },
  { value: "medium", label: "中等", hint: "26–40", range: "≈ 300 字" },
  { value: "long", label: "长文", hint: "41–80", range: "≈ 500 字" },
]

export interface ArticleParamsFormProps {
  topic: string
  onTopicChange: (topic: string) => void
  difficulty: CefrLevel
  onDifficultyChange: (d: CefrLevel) => void
  articleLength: ArticleLength
  onArticleLengthChange: (l: ArticleLength) => void
  count: number
  onCountChange: (n: number) => void
}

export function ArticleParamsForm({
  topic,
  onTopicChange,
  difficulty,
  onDifficultyChange,
  articleLength,
  onArticleLengthChange,
  count,
  onCountChange,
}: ArticleParamsFormProps) {
  return (
    <SectionPanel
      title={
        <>
          <HugeiconsIcon icon={SparklesIcon} size={16} strokeWidth={1.8} />
          文章参数
        </>
      }
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="topic">主题</Label>
          <Input
            id="topic"
            placeholder="例如：campus life / stoicism / urban design"
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5" aria-label="常用主题">
            {TOPIC_CHIPS.map((chip) => {
              const active = topic.trim() === chip.value
              return (
                <FilterChip
                  key={chip.value}
                  active={active}
                  onClick={() => onTopicChange(chip.value)}
                  className="px-2.5 py-1"
                >
                  {chip.label}
                </FilterChip>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            用英文或中文输入都可以。简短的名词短语最有效。
          </p>
        </div>

        <div className="space-y-2">
          <Label>难度</Label>
          <RadioGroup
            value={difficulty}
            onValueChange={(v) => onDifficultyChange(v as CefrLevel)}
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {difficulties.map((d) => (
              <ChoiceCard
                key={d.value}
                id={`difficulty-${d.value}`}
                value={d.value}
                selected={difficulty === d.value}
                title={d.label}
                description={d.hint}
              />
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label>文章长度</Label>
          <RadioGroup
            value={articleLength}
            onValueChange={(v) => onArticleLengthChange(v as ArticleLength)}
            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
          >
            {lengths.map((l) => (
              <ChoiceCard
                key={l.value}
                id={`length-${l.value}`}
                value={l.value}
                selected={articleLength === l.value}
                title={l.label}
                description={`目标 ${l.hint} · ${l.range}`}
                className="items-start"
              />
            ))}
          </RadioGroup>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="count">目标词数</Label>
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-2xl font-semibold tabular-nums">
                {count}
              </span>
              <span className="text-xs text-muted-foreground">
                / {MIN_TARGET_WORD_COUNT}–{MAX_TARGET_WORD_COUNT}
              </span>
            </div>
          </div>
          <Slider
            id="count"
            min={MIN_TARGET_WORD_COUNT}
            max={MAX_TARGET_WORD_COUNT}
            step={1}
            value={[count]}
            onValueChange={(v) => onCountChange(v[0] ?? count)}
          />
          <div className="flex justify-between text-[10px] tracking-wider text-muted-foreground uppercase">
            <span>{MIN_TARGET_WORD_COUNT}</span>
            <span>{MAX_TARGET_WORD_COUNT}</span>
          </div>
        </div>
      </div>
    </SectionPanel>
  )
}
