import { useState } from "react"
import { Outlet } from "react-router-dom"

import { MobileNav } from "./MobileNav"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-svh bg-background">
      <div className="flex">
        <aside className="sticky top-0 hidden h-svh w-60 shrink-0 border-r border-border/60 lg:block">
          <Sidebar />
        </aside>

        <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onMobileMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1">
            <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10 lg:py-12">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
