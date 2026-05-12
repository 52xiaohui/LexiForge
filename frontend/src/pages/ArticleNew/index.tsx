import {
  AlertCircleIcon,
  Loading02Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
} from "@/types/api"

const MIN_COUNT = 15
const MAX_COUNT = 80

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

  const { data: allWords = [] } = useQuery({
    queryKey: ["vocab", "words"],
    queryFn: async () => mockStore.listWords(),
  })

  const selectedWords = useMemo(() => {
    if (targetIds.length === 0) return []
    const map = new Map(allWords.map((w) => [w.id, w]))
    return targetIds.map((id) => map.get(id)).filter((w) => w !== undefined)
  }, [targetIds, allWords])

  const n = targetIds.length
  const overHardLimit = n > MAX_COUNT

  // Default values derived from URL.
  const defaultLength: ArticleLength = n > 0 ? recommendLength(n) : "medium"
  const defaultCount = n > 0 ? clamp(Math.max(n, lengthMedian[defaultLength]), MIN_COUNT, MAX_COUNT) : 30

  const [topic, setTopic] = useState("")
  const [difficulty, setDifficulty] = useState<CefrLevel>("B1")
  const [articleLength, setArticleLength] = useState<ArticleLength>(defaultLength)
  const [count, setCount] = useState(defaultCount)
  // Track whether the user manually moved the slider so auto-recommendation
  // (driven by articleLength) does not clobber explicit input.
  const [countTouched, setCountTouched] = useState(false)

  // Reset length / count / touched whenever the URL's ids change, and
  // re-recommend count whenever the selected length changes (unless the user
  // has already moved the slider). Both cases use React's "adjust state
  // during render" pattern rather than effects.
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

  const generate = useMutation({
    mutationFn: async (input: GenerateArticleInput) => {
      // Simulate latency to exercise the loading state.
      await new Promise((r) => setTimeout(r, 900))
      return mockStore.generateArticle(input)
    },
    onSuccess: ({ article_id }) => {
      queryClient.invalidateQueries({ queryKey: ["articles"] })
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
    !selectionExceedsCount

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
    }
    generate.mutate(input)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>文章参数</CardTitle>
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

            {firstError && (
              <div className="flex items-start gap-2 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
                <HugeiconsIcon
                  icon={AlertCircleIcon}
                  size={16}
                  strokeWidth={1.8}
                  className="mt-0.5 shrink-0"
                />
                <p className="leading-relaxed">{firstError}</p>
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                生成的文章会保存在历史里。可在详情页重新生成或导出 Markdown。
              </p>
              <Button
                size="default"
                onClick={handleSubmit}
                disabled={!canSubmit || generate.isPending}
              >
                {generate.isPending ? (
                  <>
                    <HugeiconsIcon
                      icon={Loading02Icon}
                      data-icon="inline-start"
                      strokeWidth={1.8}
                      className="animate-spin"
                    />
                    生成中…
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
      </div>

      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>目标词</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {n === 0 ? (
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>当前是自动选词模式，后端会从你的薄弱词自动挑选。</p>
                <p className="text-xs">
                  想要精确指定词汇？去{" "}
                  <a
                    href="/vocab/weak"
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    薄弱词页面
                  </a>{" "}
                  勾选想练的词再回来。
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  来自薄弱词页的勾选 · 共 {n} 个词
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedWords.map((w) => (
                    <Badge
                      key={w.id}
                      variant="outline"
                      className="text-[11px]"
                    >
                      {w.spelling}
                    </Badge>
                  ))}
                  {targetIds.length > selectedWords.length && (
                    <Badge variant="outline" className="text-[11px] text-muted-foreground">
                      + {targetIds.length - selectedWords.length} 个未知 id
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  勾选数不足目标词数时，后端会按 70/20/10 比例自动补足剩余名额。
                </p>
                <p className="text-xs text-muted-foreground">
                  推荐长度：
                  <span className="text-foreground">
                    {" "}
                    {formatArticleLength(recommendLength(n))}
                  </span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
