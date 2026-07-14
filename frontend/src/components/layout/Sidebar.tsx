import { SidebarLeft01Icon, SparklesIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link, useLocation } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useVocabSummary } from "@/hooks/use-vocab-summary"
import { cn } from "@/lib/utils"

import {
  formatCompactBadge,
  formatWeakBadge,
  generateNavItem,
  isNavItemActive,
  sidebarNavItems,
  type AppNavItem,
} from "./nav"

export interface SidebarProps {
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  /**
   * Drawer mode used by the mobile sheet overflow (if any). Always expanded.
   */
  variant?: "desktop" | "drawer"
}

/**
 * Desktop navigation: primary「生成」CTA + practice-first list with weak badge.
 * Collapsed mode becomes an icon rail with tooltips.
 */
export function Sidebar({
  collapsed = false,
  onCollapsedChange,
  variant = "desktop",
}: SidebarProps) {
  const isCollapsed = variant === "desktop" && collapsed
  const showCollapseToggle = variant === "desktop" && Boolean(onCollapsedChange)
  const { data: summary } = useVocabSummary({ silent: true })
  const weakBadge = formatWeakBadge(summary?.weak)

  return (
    <div
      className={cn(
        "flex h-full flex-col py-5 transition-[padding] duration-200 motion-reduce:transition-none",
        isCollapsed ? "px-2" : "px-4"
      )}
    >
      <BrandRow
        isCollapsed={isCollapsed}
        drawerVariant={variant === "drawer"}
        showCollapseToggle={showCollapseToggle}
        onCollapsedChange={onCollapsedChange}
      />

      <div className={cn("mt-5", isCollapsed ? "flex justify-center" : "px-0")}>
        <GenerateCta collapsed={isCollapsed} />
      </div>

      <nav aria-label="主导航" className="mt-5 flex-1">
        <ul
          className={cn(
            "space-y-0.5",
            isCollapsed && "flex flex-col items-center"
          )}
        >
          {sidebarNavItems.map((item) => (
            <li key={item.to} className={cn(isCollapsed && "w-full")}>
              <NavItemLink
                item={item}
                collapsed={isCollapsed}
                badge={item.badge === "weak" ? weakBadge : null}
              />
            </li>
          ))}
        </ul>
      </nav>

      <div
        className={cn(
          "mt-6 px-2 text-[10px] tracking-[0.16em] text-muted-foreground uppercase transition-opacity motion-reduce:transition-none",
          isCollapsed && "pointer-events-none opacity-0"
        )}
      >
        语境化背词
      </div>
    </div>
  )
}

function GenerateCta({ collapsed }: { collapsed: boolean }) {
  const { pathname } = useLocation()
  const isActive = isNavItemActive(generateNavItem, pathname)

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            size="icon"
            className={cn(
              "size-10 rounded-xl",
              isActive && "ring-2 ring-primary/40"
            )}
            aria-label="生成文章"
          >
            <Link to={generateNavItem.to} aria-current={isActive ? "page" : undefined}>
              <HugeiconsIcon icon={SparklesIcon} strokeWidth={1.8} />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">生成文章</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Button
      asChild
      className={cn("w-full justify-center rounded-xl", isActive && "ring-2 ring-primary/30")}
    >
      <Link to={generateNavItem.to} aria-current={isActive ? "page" : undefined}>
        <HugeiconsIcon
          icon={SparklesIcon}
          data-icon="inline-start"
          strokeWidth={1.8}
        />
        生成文章
      </Link>
    </Button>
  )
}

interface BrandRowProps {
  isCollapsed: boolean
  drawerVariant: boolean
  showCollapseToggle: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

function BrandRow({
  isCollapsed,
  drawerVariant,
  showCollapseToggle,
  onCollapsedChange,
}: BrandRowProps) {
  return (
    <div
      className={cn(
        "flex transition-[gap,padding] duration-200",
        isCollapsed
          ? "flex-col items-center gap-2"
          : cn("items-center gap-2.5 px-2", drawerVariant && "pr-10")
      )}
    >
      <Link
        to="/dashboard"
        aria-label="LexiForge · 回到总览"
        className="flex min-w-0 items-center gap-2.5 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <LexiForgeMark />
        <span
          className={cn(
            "min-w-0 leading-tight transition-[opacity,max-width] duration-200",
            isCollapsed
              ? "pointer-events-none max-w-0 overflow-hidden opacity-0"
              : "max-w-[140px] opacity-100"
          )}
        >
          <span className="block truncate font-heading text-base font-medium tracking-tight">
            LexiForge
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            语境化背词工具
          </span>
        </span>
      </Link>

      {showCollapseToggle && onCollapsedChange && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={isCollapsed ? "展开侧边栏" : "折叠侧边栏"}
              aria-pressed={isCollapsed}
              onClick={() => onCollapsedChange(!isCollapsed)}
              className={cn(!isCollapsed && "ms-auto")}
            >
              <HugeiconsIcon
                icon={SidebarLeft01Icon}
                strokeWidth={1.8}
                className={cn(
                  "transition-transform",
                  isCollapsed && "rotate-180"
                )}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {isCollapsed ? "展开" : "折叠"}{" "}
            <span className="opacity-60">(按 [)</span>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

function NavItemLink({
  item,
  collapsed,
  badge,
}: {
  item: AppNavItem
  collapsed: boolean
  badge?: string | null
}) {
  const { pathname } = useLocation()
  const isActive = isNavItemActive(item, pathname)
  const link = (
    <Link
      to={item.to}
      aria-current={isActive ? "page" : undefined}
      aria-label={
        collapsed
          ? badge
            ? `${item.label}，${badge}`
            : item.label
          : undefined
      }
      className={cn(
        "relative flex items-center rounded-xl text-sm transition-colors motion-reduce:transition-none",
        collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
        isActive
          ? "bg-muted text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r before:bg-primary"
          : "text-foreground/70 hover:bg-muted hover:text-foreground"
      )}
    >
      <span className="relative">
        <HugeiconsIcon icon={item.icon} size={16} strokeWidth={1.8} />
        {collapsed && badge && (
          <span className="absolute -top-1.5 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[8px] font-semibold text-white tabular-nums">
            {formatCompactBadge(badge)}
          </span>
        )}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate transition-[opacity,max-width] duration-200 motion-reduce:transition-none",
          collapsed
            ? "pointer-events-none max-w-0 overflow-hidden opacity-0"
            : "max-w-[160px] opacity-100"
        )}
      >
        {item.label}
      </span>
      {!collapsed && badge && (
        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 tabular-nums dark:text-amber-300">
          {badge}
        </span>
      )}
    </Link>
  )
  if (!collapsed) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">
        {item.label}
        {badge ? ` · ${badge}` : ""}
      </TooltipContent>
    </Tooltip>
  )
}

function LexiForgeMark() {
  return (
    <div
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"
    >
      <span
        className="font-heading text-[14px] leading-none font-semibold tracking-tight"
        style={{ fontFeatureSettings: '"ss01" on' }}
      >
        Lx
      </span>
    </div>
  )
}
