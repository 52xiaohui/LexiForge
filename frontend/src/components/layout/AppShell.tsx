import { Suspense, useEffect, useState } from "react"
import { Outlet, useLocation, useMatches } from "react-router-dom"

import type { RouteHandle } from "@/app/router"
import { ErrorBoundary } from "@/components/common/ErrorBoundary"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import { MobileBottomNav } from "./MobileBottomNav"
import { shouldHideMobileTabBar } from "./nav"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"

function isRouteHandle(handle: unknown): handle is RouteHandle {
  return typeof handle === "object" && handle !== null && "title" in handle
}

const COLLAPSED_KEY = "lexiforge.sidebarCollapsed"

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false
  try {
    // Prefer icon-rail on first visit so reading keeps more width.
    const raw = window.localStorage.getItem(COLLAPSED_KEY)
    if (raw === null) return true
    return raw === "1"
  } catch {
    return true
  }
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed)
  const { pathname } = useLocation()
  const matches = useMatches()
  const hideTabs = shouldHideMobileTabBar(pathname)

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0")
    } catch {
      // non-fatal
    }
  }, [collapsed])

  useEffect(() => {
    const current = matches.at(-1)
    const handle = isRouteHandle(current?.handle) ? current.handle : null
    document.title = handle?.title
      ? `${handle.title} · LexiForge`
      : "LexiForge"
  }, [matches, pathname])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.repeat) return
      if (e.key !== "[") return
      const target = e.target
      if (target instanceof HTMLElement) {
        if (target.isContentEditable) return
        if (target.closest("input, textarea, select, [contenteditable='true']"))
          return
      }
      e.preventDefault()
      setCollapsed((c) => !c)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <div className="min-h-svh bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-foreground focus:px-3 focus:py-1.5 focus:text-xs focus:font-medium focus:text-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        跳到主内容
      </a>

      <div className="flex">
        <aside
          className={cn(
            "sticky top-0 hidden h-svh shrink-0 border-r border-border/60 transition-[width] duration-200 lg:block",
            collapsed ? "w-16" : "w-60"
          )}
        >
          <Sidebar
            collapsed={collapsed}
            onCollapsedChange={setCollapsed}
            variant="desktop"
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main id="main" tabIndex={-1} className="flex-1 outline-none">
            <div
              className={cn(
                "mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-12",
                hideTabs ? "pb-8 lg:pb-12" : "pb-24 lg:pb-12"
              )}
            >
              <ErrorBoundary>
                <Suspense fallback={<RouteSkeleton />}>
                  <Outlet />
                </Suspense>
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>

      <MobileBottomNav />
    </div>
  )
}

function RouteSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}
