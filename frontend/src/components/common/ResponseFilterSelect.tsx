import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LAST_RESPONSE_OPTIONS,
  type ResponseFilter,
} from "@/lib/last-response"
import { cn } from "@/lib/utils"

export interface ResponseFilterSelectProps {
  value: ResponseFilter
  onValueChange: (value: ResponseFilter) => void
  label?: string
  className?: string
  triggerClassName?: string
}

/** Shared last_response filter used on 全部单词 and 薄弱词. */
export function ResponseFilterSelect({
  value,
  onValueChange,
  label = "反馈",
  className,
  triggerClassName,
}: ResponseFilterSelectProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && (
        <Label className="text-xs text-muted-foreground">{label}</Label>
      )}
      <Select
        value={value}
        onValueChange={(v) => onValueChange(v as ResponseFilter)}
      >
        <SelectTrigger size="sm" className={cn("min-w-32", triggerClassName)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LAST_RESPONSE_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
