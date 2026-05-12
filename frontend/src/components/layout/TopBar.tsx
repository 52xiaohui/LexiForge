import { Menu02Icon, Refresh01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMatches } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { RouteHandle } from "@/app/router"

function isRouteHandle(handle: unknown): handle is RouteHandle {
  return typeof handle === "object" && handle !== null && "title" in handle
}

export interface TopBarProps {
  onMobileMenuClick: () => void
}

export function TopBar({ onMobileMenuClick }: TopBarProps) {
  const matches = useMatches()
  const current = matches.at(-1)
  const handle = isRouteHandle(current?.handle) ? current.handle : null
  const title = handle?.title ?? ""
  const subtitle = handle?.subtitle

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-6 lg:px-10">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="打开菜单"
          className="lg:hidden"
          onClick={onMobileMenuClick}
        >
          <HugeiconsIcon icon={Menu02Icon} strokeWidth={1.8} />
        </Button>

        <div className="min-w-0 flex-1">
          <div className="truncate font-heading text-base font-medium leading-tight">
            {title}
          </div>
          {subtitle && (
            <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
          )}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" disabled>
              <HugeiconsIcon
                icon={Refresh01Icon}
                data-icon="inline-start"
                strokeWidth={1.8}
              />
              同步
            </Button>
          </TooltipTrigger>
          <TooltipContent>MVP 阶段同步通过 env Token，下个版本接入界面</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
