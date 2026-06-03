import {
  Delete02Icon,
  Notebook02Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { EmptyState, ErrorState } from "@/components/common/StatusPanel"
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  formatArticleLength,
  formatCoverage,
  formatDifficulty,
  formatRelativeTime,
} from "@/lib/formatters"
import { mockStore } from "@/lib/mock-data"
import { withSim } from "@/lib/query-sim"
import type { ArticleDetail } from "@/types/api"

export function Articles() {
  const queryClient = useQueryClient()
  const { data = [], isPending, isError, refetch } = useQuery({
    queryKey: ["articles", "list"],
    queryFn: withSim(async () => mockStore.listArticles(), { emptyValue: [] }),
  })

  const deleteArticle = useMutation({
    mutationFn: async (id: string): Promise<ArticleDetail> => {
      const removed = mockStore.deleteArticle(id)
      if (!removed) throw new Error("该文章已不存在")
      return removed
    },
    // Status-card-less surface — own the feedback via sonner.
    meta: { silent: true },
    onSuccess: (detail) => {
      queryClient.invalidateQueries({ queryKey: ["articles"] })
      toast("已删除文章", {
        description: `《${detail.title}》`,
        duration: 6000,
        action: {
          label: "撤销",
          onClick: () => {
            mockStore.restoreArticle(detail)
            queryClient.invalidateQueries({ queryKey: ["articles"] })
            toast.success("已撤销删除")
          },
        },
      })
    },
    onError: (error) => {
      toast.error("删除失败", {
        description:
          error instanceof Error ? error.message : "请稍后再试。",
      })
    },
  })

  if (isPending) {
    return <ArticleListSkeleton />
  }

  if (isError) {
    return (
      <ErrorState
        description="没能加载文章历史。请稍后重试。"
        onRetry={() => refetch()}
      />
    )
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={Notebook02Icon}
        title="还没有文章"
        description="点击下方按钮，用你的薄弱词生成第一篇文章。"
        action={
          <Button asChild size="default">
            <Link to="/articles/new">
              <HugeiconsIcon
                icon={SparklesIcon}
                data-icon="inline-start"
                strokeWidth={1.8}
              />
              生成新文章
            </Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          共 {data.length} 篇文章 · 按生成时间倒序
        </p>
        <Button asChild size="sm">
          <Link to="/articles/new">
            <HugeiconsIcon
              icon={SparklesIcon}
              data-icon="inline-start"
              strokeWidth={1.8}
            />
            新文章
          </Link>
        </Button>
      </div>

      <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 sm:space-y-3 sm:divide-y-0 sm:overflow-visible sm:rounded-none sm:border-0">
        {data.map((article) => (
          <li
            key={article.id}
            className="group flex flex-col gap-3 bg-card p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4 sm:rounded-2xl sm:border sm:border-border/60 sm:ring-1 sm:ring-foreground/5"
          >
            <Link
              to={`/articles/${article.id}`}
              className="min-w-0 flex-1 space-y-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-heading text-base font-medium leading-snug group-hover:underline">
                  {article.title}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">
                  {formatDifficulty(article.difficulty)}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {formatArticleLength(article.article_length)}
                </Badge>
                <span>覆盖 {formatCoverage(article.coverage_rate)}</span>
                <span aria-hidden>·</span>
                <span>
                  {article.covered_word_count} / {article.target_word_count} 词
                </span>
                <span aria-hidden>·</span>
                <span>{article.topic}</span>
                <span aria-hidden>·</span>
                <span>{formatRelativeTime(article.created_at)}</span>
              </div>
            </Link>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`删除 ${article.title}`}
                  className="self-end text-muted-foreground hover:text-destructive sm:self-center"
                >
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.8} />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>删除这篇文章？</AlertDialogTitle>
                  <AlertDialogDescription>
                    《{article.title}》将从历史中移除，操作不可撤销。
                    （MVP 阶段删除是前端原型，真实 API 接入后会调用 DELETE /articles/:id。）
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => deleteArticle.mutate(article.id)}
                  >
                    删除
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ArticleListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <ul className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4"
          >
            <Skeleton className="h-5 w-2/3" />
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
