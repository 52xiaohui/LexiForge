import type { ReactNode } from "react"

import { RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"

export interface ChoiceCardProps {
  id: string
  value: string
  selected: boolean
  title: ReactNode
  description?: ReactNode
  className?: string
}

/**
 * Bordered radio option card used for CEFR difficulty / article length etc.
 * Pair with a parent `RadioGroup`.
 */
export function ChoiceCard({
  id,
  value,
  selected,
  title,
  description,
  className,
}: ChoiceCardProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : "border-border/60 hover:bg-muted/40",
        className
      )}
    >
      <div className="min-w-0">
        <div className="font-heading text-sm font-medium">{title}</div>
        {description && (
          <div className="text-[10px] text-muted-foreground">{description}</div>
        )}
      </div>
      <RadioGroupItem id={id} value={value} />
    </label>
  )
}
