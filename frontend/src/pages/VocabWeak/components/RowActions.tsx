import {
  CheckmarkCircle02Icon,
  MoreHorizontalIcon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function RowActions({
  spelling,
  onMaster,
  onIgnore,
}: {
  spelling: string
  onMaster: () => void
  onIgnore: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`${spelling} 操作`}
          className="text-muted-foreground"
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={1.8} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1">
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            onMaster()
          }}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
        >
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            size={14}
            strokeWidth={1.8}
          />
          <span>标记为已掌握</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            onIgnore()
          }}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted"
        >
          <HugeiconsIcon icon={ViewOffSlashIcon} size={14} strokeWidth={1.8} />
          <span>暂时忽略</span>
        </button>
      </PopoverContent>
    </Popover>
  )
}
