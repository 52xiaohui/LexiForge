import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export interface ListSkeletonProps {
  rows?: number
  /** Show a leading checkbox placeholder (selectable lists). */
  selectable?: boolean
  /** Extra skeleton blocks above the list (filters, chips). */
  header?: "vocab" | "weak" | "articles" | "none"
  className?: string
}

export function ListSkeleton({
  rows = 8,
  selectable = false,
  header = "none",
  className,
}: ListSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {header === "vocab" && (
        <>
          <Skeleton className="h-4 w-56" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-14 w-full rounded-2xl" />
        </>
      )}
      {header === "weak" && (
        <>
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </>
      )}
      {header === "articles" && (
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      )}

      {header === "articles" ? (
        <ul className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <li
              key={i}
              className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4"
            >
              <Skeleton className="h-5 w-2/3" />
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-2 rounded-2xl border border-border/60 p-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              {selectable && <Skeleton className="size-4 rounded" />}
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
              {!selectable && <Skeleton className="h-4 w-16" />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
