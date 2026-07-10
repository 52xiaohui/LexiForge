import { Loading02Icon, SparklesIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"

export interface GenerateButtonProps {
  isPending: boolean
  isError: boolean
  canSubmit: boolean
  onSubmit: () => void
  className?: string
}

export function GenerateButton({
  isPending,
  isError,
  canSubmit,
  onSubmit,
  className,
}: GenerateButtonProps) {
  return (
    <Button
      size="default"
      onClick={onSubmit}
      disabled={!canSubmit}
      className={className}
    >
      {isPending ? (
        <>
          <HugeiconsIcon
            icon={Loading02Icon}
            data-icon="inline-start"
            strokeWidth={1.8}
            className="animate-spin"
          />
          生成中…
        </>
      ) : isError ? (
        <>
          <HugeiconsIcon
            icon={SparklesIcon}
            data-icon="inline-start"
            strokeWidth={1.8}
          />
          重试
        </>
      ) : (
        <>
          <HugeiconsIcon
            icon={SparklesIcon}
            data-icon="inline-start"
            strokeWidth={1.8}
          />
          生成文章
        </>
      )}
    </Button>
  )
}
