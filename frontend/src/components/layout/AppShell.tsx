import { Suspense, useEffect, useState } from "react"
import { Outlet } from "react-router-dom"

import { ErrorBoundary } from "@/components/common/ErrorBoundary"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

import { MobileNav } from "./MobileNav"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"

const COLLAPSED_KEY = "lexiforge.sidebarCollapsed"

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1"
  } catch {
    return false
  }
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed)

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0")
    } catch {
      // non-fatal
    }
  }, [collapsed])

  // Keyboard shortcut: `[` toggles the sidebar without reaching for the
  // mouse. We deliberately ignore the event when focus is in an editable
  // surface (so typing `[` in inputs / textareas stays inert) and skip
  // modifier combos so OS shortcuts like ⌘[ for browser-back keep working.
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
      {/* Keyboard / screen-reader escape to the main content. Visually hidden
          until it receives focus. */}
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
            collapsed ? "w-16" : "w-60",
          )}
        >
          <Sidebar
            collapsed={collapsed}
            onCollapsedChange={setCollapsed}
            variant="desktop"
          />
        </aside>

        <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onMobileMenuClick={() => setMobileOpen(true)} />
          <main
            id="main"
            tabIndex={-1}
            className="flex-1 outline-none"
          >
            <div
              className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10 lg:py-12"
              // Honour the iOS safe-area so fixed bars (VocabWeak floating bar
              // etc.) have room on notched devices.
              style={{ paddingBottom: "max(3rem, env(safe-area-inset-bottom))" }}
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
