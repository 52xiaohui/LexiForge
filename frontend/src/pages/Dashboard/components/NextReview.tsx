import {
  AlertCircleIcon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "react-router-dom"

import { LastResponseBadge } from "@/components/common/LastResponseBadge"
import { SectionPanel } from "@/components/common/SectionPanel"
import { WeakScoreMeter } from "@/components/common/WeakScoreMeter"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { WeakWord } from "@/types/api"

export interface NextReviewProps {
  words: WeakWord[]
}

export function NextReview({ words }: NextReviewProps) {
  return (
    <SectionPanel
      title={
        <>
          <HugeiconsIcon icon={AlertCircleIcon} size={16} strokeWidth={1.8} />
          下次建议复习
        </>
      }
      action={
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
      }
    >
      {words.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          没有待复习的薄弱词。
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {words.map((word) => (
            <li
              key={word.id}
              className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
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
    </SectionPanel>
  )
}
