import {
  AlertCircleIcon,
  Book02Icon,
  BookOpen02Icon,
  DashboardCircleIcon,
  Notebook02Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { NavLink } from "react-router-dom"

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

export function Sidebar() {
  return (
    <div className="flex h-full flex-col px-4 py-6">
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <div className="grid size-9 place-items-center rounded-2xl bg-foreground text-background">
          <HugeiconsIcon icon={BookOpen02Icon} size={18} strokeWidth={2} />
        </div>
        <div className="leading-tight">
          <div className="font-heading text-base font-medium tracking-tight">LexiForge</div>
          <div className="text-[11px] text-muted-foreground">语境化背词工具</div>
        </div>
      </div>

      <nav className="flex-1 space-y-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="mb-2 px-2 text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-foreground text-background"
                          : "text-foreground/70 hover:bg-muted hover:text-foreground",
                      )
                    }
                  >
                    <HugeiconsIcon icon={item.icon} size={16} strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-6 px-2 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">
        MVP · v0.1
      </div>
    </div>
  )
}
