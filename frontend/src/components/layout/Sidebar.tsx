import {
  AlertCircleIcon,
  Book02Icon,
  DashboardCircleIcon,
  Notebook02Icon,
  SidebarLeft01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { NavLink } from "react-router-dom"

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
  end?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: "总览",
    items: [{ to: "/dashboard", label: "Dashboard", icon: DashboardCircleIcon }],
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
      { to: "/articles", label: "文章历史", icon: Notebook02Icon, end: true },
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
  return (
    <div
      className={cn(
        "flex h-full flex-col py-6 transition-[padding] duration-200",
        isCollapsed ? "px-2" : "px-4",
      )}
    >
      <div
        className={cn(
          "mb-8 flex items-center gap-2.5",
          isCollapsed ? "justify-center" : "px-2",
        )}
      >
        <LexiForgeMark />
        {!isCollapsed && (
          <div className="min-w-0 leading-tight">
            <div className="truncate font-heading text-base font-medium tracking-tight">
              LexiForge
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              语境化背词工具
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!isCollapsed && (
              <div className="mb-2 px-2 text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                {group.label}
              </div>
            )}
            <ul className={cn("space-y-0.5", isCollapsed && "flex flex-col items-center")}>
              {group.items.map((item) => (
                <li key={item.to} className={cn(isCollapsed && "w-full")}>
                  <NavItemLink item={item} collapsed={isCollapsed} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {variant === "desktop" && onCollapsedChange && (
        <div
          className={cn(
            "mt-6 flex items-center",
            isCollapsed ? "justify-center" : "justify-between px-2",
          )}
        >
          {!isCollapsed && (
            <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
              MVP · v0.1
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={isCollapsed ? "展开侧边栏" : "折叠侧边栏"}
                aria-pressed={isCollapsed}
                onClick={() => onCollapsedChange(!isCollapsed)}
              >
                <HugeiconsIcon
                  icon={SidebarLeft01Icon}
                  strokeWidth={1.8}
                  className={cn(
                    "transition-transform",
                    isCollapsed && "rotate-180",
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isCollapsed ? "展开侧边栏" : "折叠侧边栏"}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {variant === "drawer" && (
        <div className="mt-6 px-2 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
          MVP · v0.1
        </div>
      )}
    </div>
  )
}

interface NavItemLinkProps {
  item: NavItem
  collapsed: boolean
}

function NavItemLink({ item, collapsed }: NavItemLinkProps) {
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          "flex items-center rounded-xl text-sm transition-colors",
          collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
          isActive
            ? "bg-foreground text-background"
            : "text-foreground/70 hover:bg-muted hover:text-foreground",
        )
      }
    >
      <HugeiconsIcon icon={item.icon} size={16} strokeWidth={1.8} />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
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
 * LexiForge wordmark tile — a flat black rounded square with a custom "Lx"
 * monogram in Geist Variable, leaning into the typographic brand rather than
 * a generic book icon.
 */
function LexiForgeMark() {
  return (
    <div
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-2xl bg-foreground text-background"
    >
      <span
        className="font-heading text-[14px] font-semibold leading-none tracking-tight"
        style={{ fontFeatureSettings: '"ss01" on' }}
      >
        Lx
      </span>
    </div>
  )
}
