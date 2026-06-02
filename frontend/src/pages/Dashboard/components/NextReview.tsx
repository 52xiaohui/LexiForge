import {
  AlertCircleIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "react-router-dom"

import { LastResponseBadge } from "@/components/common/LastResponseBadge"
import { WeakScoreMeter } from "@/components/common/WeakScoreMeter"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { WeakWord } from "@/types/api"

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
                    <LastResponseBadge value={word.last_response} />
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
                <div className="flex shrink-0 flex-col items-end">
                  <WeakScoreMeter score={word.weak_score} variant="compact" />
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
