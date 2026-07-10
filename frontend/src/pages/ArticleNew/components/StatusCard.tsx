import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Loading02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "react-router-dom"

import { SectionPanel } from "@/components/common/SectionPanel"
import { Button } from "@/components/ui/button"
import { errorMessage } from "@/lib/errors"

import { GenerateButton } from "./GenerateButton"

export interface StatusCardProps {
  isPending: boolean
  isError: boolean
  error: unknown
  firstError: string | null
  canSubmit: boolean
  onSubmit: () => void
  onReset: () => void
  targetCount: number
}

export function StatusCard({
  isPending,
  isError,
  error,
  firstError,
  canSubmit,
  onSubmit,
  onReset,
  targetCount,
}: StatusCardProps) {
  const errMsg = isError ? errorMessage(error, "生成失败，请稍后再试。") : null

  return (
    <SectionPanel
      title={
        isPending ? (
          <>
            <HugeiconsIcon
              icon={Loading02Icon}
              size={16}
              strokeWidth={1.8}
              className="animate-spin"
            />
            生成中
          </>
        ) : isError ? (
          <>
            <HugeiconsIcon
              icon={AlertCircleIcon}
              size={16}
              strokeWidth={1.8}
              className="text-destructive"
            />
            生成失败
          </>
        ) : (
          <>
            <HugeiconsIcon
              icon={CheckmarkCircle02Icon}
              size={16}
              strokeWidth={1.8}
            />
            准备就绪
          </>
        )
      }
    >
      <div className="space-y-3 text-sm">
        {isPending && (
          <p className="leading-relaxed text-muted-foreground">
            正在调用模型合成约 {targetCount} 个目标词的英文短文，通常需要 15–30
            秒。
            <span className="block text-xs">
              生成成功后会自动跳转到文章详情页。
            </span>
          </p>
        )}

        {errMsg && (
          <div className="space-y-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            <p className="leading-relaxed">{errMsg}</p>
            <p className="text-xs text-destructive/80">
              保留了参数，可以直接重试，或者先到
              <Link
                to="/vocab/weak"
                className="mx-1 underline underline-offset-4 hover:text-destructive"
              >
                薄弱词
              </Link>
              调整勾选。
            </p>
          </div>
        )}

        {!isPending && !errMsg && firstError && (
          <div className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            <HugeiconsIcon
              icon={AlertCircleIcon}
              size={16}
              strokeWidth={1.8}
              className="mt-0.5 shrink-0"
            />
            <p className="leading-relaxed">{firstError}</p>
          </div>
        )}

        {!isPending && !errMsg && !firstError && (
          <p className="leading-relaxed text-muted-foreground">
            生成的文章会保存在历史里。详情页可以重新生成或导出 Markdown。
          </p>
        )}

        <div className="hidden items-center gap-2 pt-1 lg:flex">
          {errMsg && (
            <Button variant="outline" size="sm" onClick={onReset}>
              取消
            </Button>
          )}
          <GenerateButton
            isPending={isPending}
            isError={isError}
            canSubmit={canSubmit}
            onSubmit={onSubmit}
            className="ms-auto"
          />
        </div>
      </div>
    </SectionPanel>
  )
}
