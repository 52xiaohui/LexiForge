import {
  AlertCircleIcon,
  Book02Icon,
  DashboardCircleIcon,
  Notebook02Icon,
  SidebarLeft01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Fragment } from "react"
import { Link, useLocation } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface NavItem {
  to: string
  label: string
  icon: IconSvgElement
  /**
   * When true, the item is only active on an exact path match. Defaults to a
   * prefix match so a section item stays highlighted on nested routes.
   */
  end?: boolean
  /**
   * Escape hatch for sections whose nested routes cannot be expressed by a
   * simple prefix rule.
   */
  match?: (pathname: string) => boolean
}

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname)
  if (item.end) return pathname === item.to
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: "总览",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: DashboardCircleIcon },
    ],
  },
  {
    label: "单词",
    items: [
      { to: "/vocab", label: "全部单词", icon: Book02Icon, end: true },
      { to: "/vocab/weak", label: "薄弱词", icon: AlertCircleIcon },
    ],
  },
  {
    label: "文章",
    items: [
      {
        to: "/articles",
        label: "文章历史",
        icon: Notebook02Icon,
        match: (p) =>
          p === "/articles" ||
          (p.startsWith("/articles/") && p !== "/articles/new"),
      },
      { to: "/articles/new", label: "生成文章", icon: SparklesIcon },
    ],
  },
]

export interface SidebarProps {
  /**
   * When true, collapse to an icon-only rail. The AppShell owns this state so
   * the outer aside can animate its width in lockstep.
   */
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  /**
   * Drawer mode used by the mobile sheet. Always renders fully expanded and
   * hides the desktop collapse button.
   */
  variant?: "desktop" | "drawer"
}

export function Sidebar({
  collapsed = false,
  onCollapsedChange,
  variant = "desktop",
}: SidebarProps) {
  const isCollapsed = variant === "desktop" && collapsed
  const showCollapseToggle = variant === "desktop" && Boolean(onCollapsedChange)

  return (
    <div
      className={cn(
        "flex h-full flex-col py-5 transition-[padding] duration-200 motion-reduce:transition-none",
        isCollapsed ? "px-2" : "px-4"
      )}
    >
      {/* Brand row — clickable home + collapse toggle pinned at the same
          height. When expanded the toggle sits at the row's trailing edge;
          when collapsed it stacks just below the brand mark so it stays
          discoverable without hunting at the bottom of the rail. */}
      <BrandRow
        isCollapsed={isCollapsed}
        // Reserve room for the Sheet's default close X in the mobile drawer
        // so the brand row doesn't collide with it.
        drawerVariant={variant === "drawer"}
        showCollapseToggle={showCollapseToggle}
        onCollapsedChange={onCollapsedChange}
      />

      <nav aria-label="主导航" className="mt-6 flex-1">
        {navGroups.map((group, gi) => {
          const groupLabelId = `nav-group-${gi}`
          return (
            <Fragment key={group.label}>
              {/* Collapsed mode loses the group label, so we draw a thin rule
                between groups to preserve the rhythmic separation the label
                used to provide. */}
              {isCollapsed && gi > 0 && (
                <div
                  aria-hidden
                  className="mx-auto my-3 h-px w-6 bg-border/60"
                />
              )}
              <div className={cn(!isCollapsed && gi > 0 && "mt-6")}>
                <div
                  id={groupLabelId}
                  className={cn(
                    "mb-2 px-2 text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase transition-opacity motion-reduce:transition-none",
                    // Fade rather than unmount so the label appears smoothly
                    // when the rail expands. Kept in the DOM while collapsed so
                    // it can still label the group for assistive tech.
                    isCollapsed
                      ? "pointer-events-none mb-0 h-0 opacity-0"
                      : "opacity-100"
                  )}
                >
                  {group.label}
                </div>
                <ul
                  aria-labelledby={groupLabelId}
                  className={cn(
                    "space-y-0.5",
                    isCollapsed && "flex flex-col items-center"
                  )}
                >
                  {group.items.map((item) => (
                    <li key={item.to} className={cn(isCollapsed && "w-full")}>
                      <NavItemLink item={item} collapsed={isCollapsed} />
                    </li>
                  ))}
                </ul>
              </div>
            </Fragment>
          )
        })}
      </nav>

      {/* Footer — always shows the version pill. The collapse control used to
          live here; it now lives next to the brand for shorter mouse travel. */}
      <div
        className={cn(
          "mt-6 transition-opacity motion-reduce:transition-none",
          isCollapsed && "opacity-0"
        )}
      >
        <div className="px-2 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          MVP · v0.1
        </div>
      </div>
    </div>
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
        aria-label="LexiForge · 回到 Dashboard"
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
              // Trailing-edge in expanded mode, centered-stack in collapsed.
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

interface NavItemLinkProps {
  item: NavItem
  collapsed: boolean
}

function NavItemLink({ item, collapsed }: NavItemLinkProps) {
  const { pathname } = useLocation()
  const isActive = isItemActive(item, pathname)
  const link = (
    <Link
      to={item.to}
      aria-current={isActive ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        // Keep the rail item shape stable across modes so the active marker
        // changes without resizing the link box.
        "relative flex items-center rounded-xl text-sm transition-colors motion-reduce:transition-none",
        collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
        isActive
          ? "bg-muted text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r before:bg-primary"
          : "text-foreground/70 hover:bg-muted hover:text-foreground"
      )}
    >
      <HugeiconsIcon icon={item.icon} size={16} strokeWidth={1.8} />
      {/* Fade label rather than remove it from the DOM, so layout doesn't
          flicker mid-transition. The width handle keeps the rail tight. */}
      <span
        className={cn(
          "min-w-0 truncate transition-[opacity,max-width] duration-200 motion-reduce:transition-none",
          collapsed
            ? "pointer-events-none max-w-0 overflow-hidden opacity-0"
            : "max-w-[160px] opacity-100"
        )}
      >
        {item.label}
      </span>
    </Link>
  )
  if (!collapsed) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * LexiForge wordmark tile — a brand-indigo rounded square with a custom "Lx"
 * monogram in Geist Variable, leaning into the typographic brand rather than
 * a generic book icon.
 */
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
