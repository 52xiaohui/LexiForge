import { lazy } from "react"
import { createBrowserRouter, Navigate } from "react-router-dom"

import { AppShell } from "@/components/layout/AppShell"

// Dashboard is the default landing page and lightweight, so keep it eager.
import { Dashboard } from "@/pages/Dashboard"
import { NotFound } from "@/pages/NotFound"

// Heavier routes (ArticleDetail ~25KB, ArticleNew ~20KB, VocabWeak ~17KB) are
// behind React.lazy so the initial bundle only carries shell + dashboard.
const ArticleDetail = lazy(() =>
  import("@/pages/ArticleDetail").then((m) => ({ default: m.ArticleDetail })),
)
const ArticleNew = lazy(() =>
  import("@/pages/ArticleNew").then((m) => ({ default: m.ArticleNew })),
)
const Articles = lazy(() =>
  import("@/pages/Articles").then((m) => ({ default: m.Articles })),
)
const Vocab = lazy(() =>
  import("@/pages/Vocab").then((m) => ({ default: m.Vocab })),
)
const VocabWeak = lazy(() =>
  import("@/pages/VocabWeak").then((m) => ({ default: m.VocabWeak })),
)

export interface RouteHandle {
  title: string
  subtitle?: string
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: "dashboard",
        element: <Dashboard />,
        handle: { title: "总览", subtitle: "你的学习健康度" } satisfies RouteHandle,
      },
      {
        path: "vocab",
        element: <Vocab />,
        handle: { title: "单词总览" } satisfies RouteHandle,
      },
      {
        path: "vocab/weak",
        element: <VocabWeak />,
        handle: { title: "薄弱词", subtitle: "优先复习的词" } satisfies RouteHandle,
      },
      {
        path: "articles",
        element: <Articles />,
        handle: { title: "文章历史" } satisfies RouteHandle,
      },
      {
        path: "articles/new",
        element: <ArticleNew />,
        handle: { title: "生成文章" } satisfies RouteHandle,
      },
      {
        path: "articles/:id",
        element: <ArticleDetail />,
        handle: { title: "文章详情" } satisfies RouteHandle,
      },
      { path: "*", element: <NotFound /> },
    ],
  },
])
