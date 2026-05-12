import { ArrowRight01Icon, HourglassIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"

export interface ComingSoonProps {
  page: string
  description?: string
}

export function ComingSoon({ page, description }: ComingSoonProps) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 grid size-14 place-items-center rounded-3xl bg-muted">
          <HugeiconsIcon icon={HourglassIcon} size={22} strokeWidth={1.6} />
        </div>
        <div className="font-heading text-2xl font-semibold tracking-tight">{page}</div>
        <p className="mt-3 text-sm text-muted-foreground">
          {description ??
            "这个页面在下一个迭代任务里实装。当前迭代聚焦于设计风格基线与主界面。"}
        </p>
        <Button asChild variant="outline" size="sm" className="mt-6">
          <Link to="/dashboard">
            回到总览
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              data-icon="inline-end"
              strokeWidth={1.8}
            />
          </Link>
        </Button>
      </div>
    </div>
  )
}
