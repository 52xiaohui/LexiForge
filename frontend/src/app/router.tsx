import { createBrowserRouter, Navigate } from "react-router-dom"

import { AppShell } from "@/components/layout/AppShell"
import { ArticleDetail } from "@/pages/ArticleDetail"
import { ArticleNew } from "@/pages/ArticleNew"
import { Articles } from "@/pages/Articles"
import { Dashboard } from "@/pages/Dashboard"
import { NotFound } from "@/pages/NotFound"
import { Vocab } from "@/pages/Vocab"
import { VocabWeak } from "@/pages/VocabWeak"

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
