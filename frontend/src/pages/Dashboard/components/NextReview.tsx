import {
  AlertCircleIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatLastResponse } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import type { LastResponse, WeakWord } from "@/types/api"

const responseStyles: Record<LastResponse, string> = {
  WELL_FAMILIAR:
    "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
  FAMILIAR:
    "border-sky-500/30 bg-sky-500/5 text-sky-700 dark:text-sky-400",
  VAGUE:
    "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400",
  FORGET:
    "border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-400",
}

export interface NextReviewProps {
  words: WeakWord[]
}

export function NextReview({ words }: NextReviewProps) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={AlertCircleIcon} size={16} strokeWidth={1.8} />
          下次建议复习
        </CardTitle>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link to="/vocab/weak">
              全部薄弱词
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                data-icon="inline-end"
                strokeWidth={1.8}
              />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {words.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            没有待复习的薄弱词。
          </p>
        ) : (
          <ul className="space-y-3">
            {words.map((word) => (
              <li key={word.id} className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate font-heading text-base font-medium tracking-tight">
                    {word.spelling}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 px-1.5 text-[10px]",
                        responseStyles[word.last_response],
                      )}
                    >
                      {formatLastResponse(word.last_response)}
                    </Badge>
                    {word.tags.includes("STICKING") && (
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        反复忘
                      </Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      练习 {word.study_count} 次
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-heading text-sm font-medium tabular-nums">
                    {word.weak_score}
                  </div>
                  <div className="text-[10px] tracking-wider text-muted-foreground uppercase">
                    weak
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
