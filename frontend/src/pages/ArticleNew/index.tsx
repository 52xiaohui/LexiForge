import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Loading02Icon,
  SparklesIcon,
  Target02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { LastResponseBadge } from "@/components/common/LastResponseBadge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { formatArticleLength } from "@/lib/formatters"
import { mockStore } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import type {
  ArticleLength,
  CefrLevel,
  GenerateArticleInput,
  LastResponse,
} from "@/types/api"

const MIN_COUNT = 15
const MAX_COUNT = 80

// Common study contexts. Clicking a chip overwrites the topic field — users
// can still type freely, the chips are an onboarding affordance for first-time
// visitors who don't know what to type.
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

const lengths: { value: ArticleLength; label: string; hint: string; range: string }[] = [
  { value: "short", label: "短文", hint: "15–25", range: "≈ 150 字" },
  { value: "medium", label: "中等", hint: "26–40", range: "≈ 300 字" },
  { value: "long", label: "长文", hint: "41–80", range: "≈ 500 字" },
]

const lengthMedian: Record<ArticleLength, number> = {
  short: 20,
  medium: 33,
  long: 60,
}

const RESPONSE_ORDER: LastResponse[] = [
  "FORGET",
  "VAGUE",
  "FAMILIAR",
  "WELL_FAMILIAR",
]

function recommendLength(n: number): ArticleLength {
  if (n <= 25) return "short"
  if (n <= 40) return "medium"
  return "long"
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

export function ArticleNew() {
  const [searchParams] = useSearchParams()
  const rawIds = (searchParams.get("target_word_ids") ?? "").trim()
  const targetIds = useMemo(
    () => (rawIds ? rawIds.split(",").filter(Boolean) : []),
    [rawIds],
  )

  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const n = targetIds.length
  const overHardLimit = n > MAX_COUNT

  const defaultLength: ArticleLength = n > 0 ? recommendLength(n) : "medium"
  const defaultCount =
    n > 0
      ? clamp(Math.max(n, lengthMedian[defaultLength]), MIN_COUNT, MAX_COUNT)
      : 30

  const [topic, setTopic] = useState("")
  const [difficulty, setDifficulty] = useState<CefrLevel>("B1")
  const [articleLength, setArticleLength] = useState<ArticleLength>(defaultLength)
  const [count, setCount] = useState(defaultCount)
  const [countTouched, setCountTouched] = useState(false)
  const [simulateFailure, setSimulateFailure] = useState(false)

  // Re-derive defaults when URL ids change or length changes (without effects).
  const [lastIds, setLastIds] = useState(rawIds)
  const [lastLength, setLastLength] = useState(articleLength)

  if (lastIds !== rawIds) {
    setLastIds(rawIds)
    setLastLength(defaultLength)
    setArticleLength(defaultLength)
    setCount(defaultCount)
    setCountTouched(false)
  } else if (lastLength !== articleLength) {
    setLastLength(articleLength)
    if (!countTouched) {
      const recommended =
        n > 0
          ? clamp(Math.max(n, lengthMedian[articleLength]), MIN_COUNT, MAX_COUNT)
          : lengthMedian[articleLength]
      setCount(recommended)
    }
  }

  const { data: preview } = useQuery({
    queryKey: ["generate", "preview", rawIds, count],
    queryFn: async () => mockStore.generationPreview(targetIds, count),
  })

  const generate = useMutation({
    mutationFn: async (input: GenerateArticleInput) => {
      await new Promise((r) => setTimeout(r, 900))
      return mockStore.generateArticle(input)
    },
    // The status card renders its own contextual failure UI, so we opt out of
    // the global toast to avoid double-reporting the same error.
    meta: { silent: true },
    onSuccess: ({ article_id }) => {
      queryClient.invalidateQueries({ queryKey: ["articles"] })
      queryClient.invalidateQueries({ queryKey: ["vocab", "weak"] })
      toast.success("文章生成完成", {
        description: "已保存到历史，正在跳转到详情页。",
      })
      navigate(`/articles/${article_id}`)
    },
  })

  // Validation.
  const countInRange = count >= MIN_COUNT && count <= MAX_COUNT
  const selectionExceedsCount = n > count
  const canSubmit =
    topic.trim().length > 0 &&
    countInRange &&
    !overHardLimit &&
    !selectionExceedsCount &&
    !generate.isPending

  const firstError = (() => {
    if (topic.trim().length === 0) return "请先输入文章主题"
    if (overHardLimit)
      return `已勾选 ${n} 个词，超过单篇上限 ${MAX_COUNT}，请拆分成多篇`
    if (!countInRange) return `目标词数必须在 ${MIN_COUNT} – ${MAX_COUNT} 之间`
    if (selectionExceedsCount)
      return `已勾选 ${n} 个词，超过目标词数 ${count}，请减少勾选或调长文章`
    return null
  })()

  const handleSubmit = () => {
    if (!canSubmit) return
    const input: GenerateArticleInput = {
      topic: topic.trim(),
      difficulty,
      target_word_count: count,
      article_length: articleLength,
      ...(n > 0 ? { target_word_ids: targetIds } : {}),
      ...(simulateFailure ? { simulate_failure: true } : {}),
    }
    generate.mutate(input)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Left column — parameters */}
      <div className="space-y-6 lg:col-span-3">
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={SparklesIcon} size={16} strokeWidth={1.8} />
              文章参数
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-2">
              <Label htmlFor="topic">主题</Label>
              <Input
                id="topic"
                placeholder="例如：campus life / stoicism / urban design"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5" aria-label="常用主题">
                {TOPIC_CHIPS.map((chip) => {
                  const active = topic.trim() === chip.value
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => setTopic(chip.value)}
                      aria-pressed={active}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border/60 text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                      )}
                    >
                      {chip.label}
                    </button>
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
                onValueChange={(v) => setDifficulty(v as CefrLevel)}
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                {difficulties.map((d) => (
                  <label
                    key={d.value}
                    htmlFor={`difficulty-${d.value}`}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                      difficulty === d.value
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:bg-muted/40",
                    )}
                  >
                    <div>
                      <div className="font-heading text-sm font-medium">{d.label}</div>
                      <div className="text-[10px] text-muted-foreground">{d.hint}</div>
                    </div>
                    <RadioGroupItem id={`difficulty-${d.value}`} value={d.value} />
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>文章长度</Label>
              <RadioGroup
                value={articleLength}
                onValueChange={(v) => setArticleLength(v as ArticleLength)}
                className="grid grid-cols-1 gap-2 sm:grid-cols-3"
              >
                {lengths.map((l) => (
                  <label
                    key={l.value}
                    htmlFor={`length-${l.value}`}
                    className={cn(
                      "flex cursor-pointer items-start justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                      articleLength === l.value
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:bg-muted/40",
                    )}
                  >
                    <div>
                      <div className="font-heading text-sm font-medium">{l.label}</div>
                      <div className="text-[10px] text-muted-foreground">
                        目标 {l.hint} · {l.range}
                      </div>
                    </div>
                    <RadioGroupItem id={`length-${l.value}`} value={l.value} />
                  </label>
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
                    / {MIN_COUNT}–{MAX_COUNT}
                  </span>
                </div>
              </div>
              <Slider
                id="count"
                min={MIN_COUNT}
                max={MAX_COUNT}
                step={1}
                value={[count]}
                onValueChange={(v) => {
                  setCount(v[0] ?? count)
                  setCountTouched(true)
                }}
              />
              <div className="flex justify-between text-[10px] tracking-wider text-muted-foreground uppercase">
                <span>{MIN_COUNT}</span>
                <span>{MAX_COUNT}</span>
              </div>
            </div>

            {import.meta.env.DEV && (
              <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={simulateFailure}
                  onCheckedChange={(v) => setSimulateFailure(v === true)}
                />
                模拟生成失败（调试用）
              </Label>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right column — preview + status */}
      <div className="space-y-4 lg:col-span-2">
        <PreviewCard
          words={preview?.words ?? []}
          countsByResponse={preview?.counts_by_response}
          stickingCount={preview?.sticking_count ?? 0}
          autoFillCount={preview?.auto_fill_count ?? 0}
          isAuto={preview?.is_auto ?? true}
          totalPicked={n}
          targetCount={count}
          recommendedLength={n > 0 ? recommendLength(n) : null}
        />

        <StatusCard
          isPending={generate.isPending}
          isError={generate.isError}
          error={generate.error}
          firstError={firstError}
          canSubmit={canSubmit}
          onSubmit={handleSubmit}
          onReset={() => generate.reset()}
          targetCount={count}
        />
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------------
// Preview card — what the plan looks like before generation.
// --------------------------------------------------------------------------------

interface PreviewCardProps {
  words: { id: string; spelling: string; last_response: LastResponse; tags: string[] }[]
  countsByResponse: Record<LastResponse, number> | undefined
  stickingCount: number
  autoFillCount: number
  isAuto: boolean
  totalPicked: number
  targetCount: number
  recommendedLength: ArticleLength | null
}

function PreviewCard({
  words,
  countsByResponse,
  stickingCount,
  autoFillCount,
  isAuto,
  totalPicked,
  targetCount,
  recommendedLength,
}: PreviewCardProps) {
  const planSize = words.length
  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={Target02Icon} size={16} strokeWidth={1.8} />
          覆盖预览
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-xs tracking-wider text-muted-foreground uppercase">
            计划覆盖
          </div>
          <div>
            <span className="font-heading text-2xl font-semibold tabular-nums">
              {planSize}
            </span>
            <span className="text-xs text-muted-foreground">
              {" "}
              / {targetCount}
            </span>
          </div>
        </div>

        {countsByResponse && planSize > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {RESPONSE_ORDER.map((resp) => {
              const c = countsByResponse[resp] ?? 0
              if (c === 0) return null
              return (
                <div
                  key={resp}
                  className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px]"
                >
                  <LastResponseBadge value={resp} className="border-0 bg-transparent px-0" />
                  <span className="tabular-nums">{c}</span>
                </div>
              )
            })}
            {stickingCount > 0 && (
              <div className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px]">
                <span className="text-muted-foreground">反复忘</span>
                <span className="tabular-nums">{stickingCount}</span>
              </div>
            )}
          </div>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          {isAuto ? (
            <>
              当前是自动选词模式，后端会从你的薄弱词按{" "}
              <span className="text-foreground">70 / 20 / 10</span>{" "}
              的比例（遗忘 / 模糊 / 熟悉）挑选。
            </>
          ) : (
            <>
              来自薄弱词页勾选共 {totalPicked} 个。
              {autoFillCount > 0 && (
                <>
                  {" "}
                  还差 {autoFillCount} 个名额，后端会按比例自动补足。
                </>
              )}
            </>
          )}
        </p>

        {planSize > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {words.slice(0, 24).map((w) => (
              <Badge
                key={w.id}
                variant="outline"
                className={cn(
                  "text-[11px]",
                  w.tags.includes("STICKING") &&
                    "border-amber-500/40 text-amber-700 dark:text-amber-400",
                )}
              >
                {w.spelling}
              </Badge>
            ))}
            {planSize > 24 && (
              <Badge variant="outline" className="text-[11px] text-muted-foreground">
                +{planSize - 24}
              </Badge>
            )}
          </div>
        )}

        {recommendedLength && (
          <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
            推荐长度：
            <span className="text-foreground">
              {" "}
              {formatArticleLength(recommendedLength)}
            </span>
            ·
            不够时可以回{" "}
            <a
              href="/vocab/weak"
              className="underline underline-offset-4 hover:text-foreground"
            >
              薄弱词页
            </a>{" "}
            增减。
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// --------------------------------------------------------------------------------
// Status card — idle / generating / error / validation, with CTA.
// --------------------------------------------------------------------------------

interface StatusCardProps {
  isPending: boolean
  isError: boolean
  error: unknown
  firstError: string | null
  canSubmit: boolean
  onSubmit: () => void
  onReset: () => void
  targetCount: number
}

function StatusCard({
  isPending,
  isError,
  error,
  firstError,
  canSubmit,
  onSubmit,
  onReset,
  targetCount,
}: StatusCardProps) {
  const errorMessage = isError
    ? error instanceof Error
      ? error.message
      : "生成失败，请稍后再试。"
    : null

  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          {isPending ? (
            <>
              <HugeiconsIcon
                icon={Loading02Icon}
                size={16}
                strokeWidth={1.8}
                className="animate-spin"
              />
              生成中
            </>
          ) : isError ? (
            <>
              <HugeiconsIcon
                icon={AlertCircleIcon}
                size={16}
                strokeWidth={1.8}
                className="text-destructive"
              />
              生成失败
            </>
          ) : (
            <>
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={16}
                strokeWidth={1.8}
              />
              准备就绪
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-4 text-sm">
        {isPending && (
          <p className="leading-relaxed text-muted-foreground">
            正在调用模型合成约 {targetCount} 个目标词的英文短文，通常需要 15–30 秒。
            <span className="block text-xs">
              生成成功后会自动跳转到文章详情页。
            </span>
          </p>
        )}

        {errorMessage && (
          <div className="space-y-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            <p className="leading-relaxed">{errorMessage}</p>
            <p className="text-xs text-destructive/80">
              保留了参数，可以直接重试，或者先到
              <a
                href="/vocab/weak"
                className="mx-1 underline underline-offset-4 hover:text-destructive"
              >
                薄弱词
              </a>
              调整勾选。
            </p>
          </div>
        )}

        {!isPending && !errorMessage && firstError && (
          <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            <HugeiconsIcon
              icon={AlertCircleIcon}
              size={16}
              strokeWidth={1.8}
              className="mt-0.5 shrink-0"
            />
            <p className="leading-relaxed">{firstError}</p>
          </div>
        )}

        {!isPending && !errorMessage && !firstError && (
          <p className="leading-relaxed text-muted-foreground">
            生成的文章会保存在历史里。详情页可以重新生成或导出 Markdown。
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          {errorMessage && (
            <Button variant="outline" size="sm" onClick={onReset}>
              取消
            </Button>
          )}
          <Button
            size="default"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="ms-auto"
          >
            {isPending ? (
              <>
                <HugeiconsIcon
                  icon={Loading02Icon}
                  data-icon="inline-start"
                  strokeWidth={1.8}
                  className="animate-spin"
                />
                生成中…
              </>
            ) : errorMessage ? (
              <>
                <HugeiconsIcon
                  icon={SparklesIcon}
                  data-icon="inline-start"
                  strokeWidth={1.8}
                />
                重试
              </>
            ) : (
              <>
                <HugeiconsIcon
                  icon={SparklesIcon}
                  data-icon="inline-start"
                  strokeWidth={1.8}
                />
                生成文章
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
