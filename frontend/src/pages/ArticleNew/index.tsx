import {
  AlertCircleIcon,
  Loading02Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { FloatingActionBar } from "@/components/common/FloatingActionBar"
import { Button } from "@/components/ui/button"
import {
  clamp,
  lengthMedian,
  MAX_TARGET_WORD_COUNT,
  MIN_TARGET_WORD_COUNT,
  parseArticleLength,
  parseCefrLevel,
  recommendArticleLength,
  RECOMMEND_COUNT,
} from "@/lib/article-generation"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
import type {
  ArticleLength,
  CefrLevel,
  GenerateArticleInput,
} from "@/types/api"

import { ArticleParamsForm } from "./components/ArticleParamsForm"
import { GenerateButton } from "./components/GenerateButton"
import { PreviewCard } from "./components/PreviewCard"
import { StatusCard } from "./components/StatusCard"

export function ArticleNew() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawIds = (searchParams.get("target_word_ids") ?? "").trim()
  const targetIds = useMemo(
    () => (rawIds ? rawIds.split(",").filter(Boolean) : []),
    [rawIds]
  )
  const autoRecommendRaw = (searchParams.get("auto_recommend") ?? "").trim()
  const seedTopic = (searchParams.get("topic") ?? "").trim()
  const seedDifficulty = parseCefrLevel(searchParams.get("difficulty"))
  const seedLength = parseArticleLength(searchParams.get("length"))

  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const n = targetIds.length
  const overHardLimit = n > MAX_TARGET_WORD_COUNT

  const defaultLength: ArticleLength =
    seedLength ?? (n > 0 ? recommendArticleLength(n) : "medium")
  const defaultCount =
    n > 0
      ? clamp(
          Math.max(n, lengthMedian[defaultLength]),
          MIN_TARGET_WORD_COUNT,
          MAX_TARGET_WORD_COUNT
        )
      : 30

  const [topic, setTopic] = useState(seedTopic)
  const [difficulty, setDifficulty] = useState<CefrLevel>(
    seedDifficulty ?? "B1"
  )
  const [articleLength, setArticleLength] =
    useState<ArticleLength>(defaultLength)
  const [count, setCount] = useState(defaultCount)
  const [countTouched, setCountTouched] = useState(false)

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
          ? clamp(
              Math.max(n, lengthMedian[articleLength]),
              MIN_TARGET_WORD_COUNT,
              MAX_TARGET_WORD_COUNT
            )
          : lengthMedian[articleLength]
      setCount(recommended)
    }
  }

  // Deep link: ?auto_recommend=20 → fetch top weak words, then replace URL
  // with target_word_ids so preview + shareable state stay consistent.
  const shouldAutoRecommend = Boolean(autoRecommendRaw) && !rawIds
  const recommendSize = clamp(
    Number.parseInt(autoRecommendRaw, 10) || RECOMMEND_COUNT,
    1,
    MAX_TARGET_WORD_COUNT
  )
  const {
    data: recommendedPage,
    isFetching: isRecommendFetching,
    isError: isRecommendError,
    isSuccess: isRecommendSuccess,
  } = useQuery({
    queryKey: ["generate", "auto-recommend", recommendSize] as const,
    queryFn: () =>
      api.listWeakWordsPage({
        page: 1,
        pageSize: recommendSize,
        sort: "-weak_score",
      }),
    enabled: shouldAutoRecommend,
    staleTime: 30_000,
    retry: 1,
    meta: { silent: true },
  })
  // Stay in "picking" until the URL is rewritten (or the request fails).
  const recommendBusy =
    shouldAutoRecommend && (isRecommendFetching || !isRecommendError)

  useEffect(() => {
    if (!shouldAutoRecommend || !isRecommendSuccess || !recommendedPage) return

    if (recommendedPage.items.length === 0) {
      toast("没有可推荐的薄弱词", {
        description: "试试先同步墨墨，或到薄弱词页放宽筛选。",
      })
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete("auto_recommend")
          return next
        },
        { replace: true }
      )
      return
    }

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete("auto_recommend")
        next.set(
          "target_word_ids",
          recommendedPage.items.map((w) => w.id).join(",")
        )
        return next
      },
      { replace: true }
    )
    toast.success(`已推荐 ${recommendedPage.items.length} 个薄弱词`, {
      description: "可在右侧预览里确认，再填写主题生成。",
    })
  }, [
    shouldAutoRecommend,
    isRecommendSuccess,
    recommendedPage,
    setSearchParams,
  ])

  useEffect(() => {
    if (!shouldAutoRecommend || !isRecommendError) return
    toast.error("推荐失败", {
      description: "请稍后再试，或到薄弱词页手动挑选。",
    })
  }, [shouldAutoRecommend, isRecommendError])

  const {
    data: preview,
    isPending: isPreviewPending,
    isFetching: isPreviewFetching,
    isError: isPreviewError,
    refetch: refetchPreview,
  } = useQuery({
    queryKey: queryKeys.generate.preview(rawIds, count),
    queryFn: () => api.generationPreview(targetIds, count),
    retry: 1,
    // Preview is advisory; don't block the page on a slow backend.
    staleTime: 15_000,
    enabled: !shouldAutoRecommend,
  })

  const generate = useMutation({
    mutationFn: async (input: GenerateArticleInput) => {
      return api.generateArticle(input)
    },
    meta: { silent: true },
    onSuccess: ({ article_id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.vocab.all })
      toast.success("文章生成完成", {
        description: "已保存到历史，正在跳转到详情页。",
      })
      navigate(`/articles/${article_id}`)
    },
  })

  const countInRange =
    count >= MIN_TARGET_WORD_COUNT && count <= MAX_TARGET_WORD_COUNT
  const selectionExceedsCount = n > count
  const canSubmit =
    topic.trim().length > 0 &&
    countInRange &&
    !overHardLimit &&
    !selectionExceedsCount &&
    !generate.isPending &&
    !recommendBusy

  const firstError = (() => {
    if (recommendBusy || autoRecommendRaw)
      return null
    if (topic.trim().length === 0) return "请先输入文章主题"
    if (overHardLimit)
      return `已勾选 ${n} 个词，超过单篇上限 ${MAX_TARGET_WORD_COUNT}，请拆分成多篇`
    if (!countInRange)
      return `目标词数必须在 ${MIN_TARGET_WORD_COUNT} – ${MAX_TARGET_WORD_COUNT} 之间`
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

  const statusHint =
    recommendBusy || autoRecommendRaw
      ? "正在挑选薄弱词…"
      : firstError
        ? firstError
        : generate.isPending
          ? "正在生成…"
          : "准备就绪"

  return (
    <div className="pb-36 lg:pb-0">
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <ArticleParamsForm
            topic={topic}
            onTopicChange={setTopic}
            difficulty={difficulty}
            onDifficultyChange={setDifficulty}
            articleLength={articleLength}
            onArticleLengthChange={setArticleLength}
            count={count}
            onCountChange={(v) => {
              setCount(v)
              setCountTouched(true)
            }}
          />
        </div>

        <div className="space-y-6 lg:col-span-2">
          <PreviewCard
            words={preview?.words ?? []}
            countsByResponse={preview?.counts_by_response}
            stickingCount={preview?.sticking_count ?? 0}
            autoFillCount={preview?.auto_fill_count ?? 0}
            isAuto={preview?.is_auto ?? true}
            totalPicked={n}
            targetCount={count}
            recommendedLength={n > 0 ? recommendArticleLength(n) : null}
            isLoading={
              recommendBusy ||
              Boolean(autoRecommendRaw) ||
              isPreviewPending ||
              isPreviewFetching
            }
            isError={isPreviewError && !recommendBusy}
            onRetry={() => void refetchPreview()}
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

      <FloatingActionBar
        visibility="mobile"
        tone={firstError ? "destructive" : "default"}
        // Sit above the mobile bottom tab bar (same offset as VocabWeak).
        className="bottom-14 px-4 lg:bottom-0"
        contentClassName="mx-auto"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <HugeiconsIcon
            icon={
              generate.isPending || recommendBusy
                ? Loading02Icon
                : firstError
                  ? AlertCircleIcon
                  : SparklesIcon
            }
            size={18}
            strokeWidth={1.8}
            className={cn(
              (generate.isPending || recommendBusy) && "animate-spin",
              firstError && "text-destructive"
            )}
          />
          <span className={cn("truncate", firstError && "text-destructive")}>
            {statusHint}
          </span>
        </div>
        {generate.isError && (
          <Button variant="ghost" size="sm" onClick={() => generate.reset()}>
            取消
          </Button>
        )}
        <GenerateButton
          isPending={generate.isPending || recommendBusy}
          isError={generate.isError}
          canSubmit={canSubmit}
          onSubmit={handleSubmit}
        />
      </FloatingActionBar>
    </div>
  )
}
