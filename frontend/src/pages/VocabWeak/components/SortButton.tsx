import { ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { SortDir } from "@/hooks/use-sort-state"
import { cn } from "@/lib/utils"

export function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 text-left text-xs tracking-wider uppercase transition-colors",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span>{label}</span>
      {active && (
        <HugeiconsIcon
          icon={dir === "desc" ? ArrowDown01Icon : ArrowUp01Icon}
          size={12}
          strokeWidth={1.8}
        />
      )}
    </button>
  )
}
