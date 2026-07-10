import {
  Delete02Icon,
  Notebook02Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { ArticleMeta } from "@/components/articles/ArticleMeta"
import { ListSkeleton } from "@/components/common/ListSkeleton"
import { PageHeader } from "@/components/common/PageHeader"
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
import { Button } from "@/components/ui/button"
import { toastError } from "@/lib/errors"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import { withSim } from "@/lib/query-sim"
import type { Article } from "@/types/api"

export function Articles() {
  const queryClient = useQueryClient()
  const {
    data = [],
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: queryKeys.articles.list(),
    queryFn: withSim(() => api.listArticles(), { emptyValue: [] }),
  })

  const deleteArticle = useMutation({
    mutationFn: async (article: Article): Promise<Article> => {
      await api.deleteArticle(article.id)
      return article
    },
    meta: { silent: true },
    onSuccess: (detail) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.articles.all })
      toast("已删除文章", { description: `《${detail.title}》` })
    },
    onError: (error) => {
      toastError("删除失败", error)
    },
  })

  if (isPending) {
    return <ListSkeleton header="articles" />
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
      <PageHeader
        description={`共 ${data.length} 篇文章 · 按生成时间倒序`}
        action={
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
        }
      />

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
                <div className="font-heading text-base leading-snug font-medium group-hover:underline">
                  {article.title}
                </div>
              </div>
              <ArticleMeta article={article} density="full" />
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
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => deleteArticle.mutate(article)}
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
