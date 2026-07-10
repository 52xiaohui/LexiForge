/* Provider + hook share a module — same pattern as theme-provider. */
/* eslint-disable react-refresh/only-export-components */
import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { toast } from "sonner"

import { api } from "@/lib/api"
import { toastError } from "@/lib/errors"
import { queryKeys } from "@/lib/query-keys"
import { SYNC_COOLDOWN_MS } from "@/lib/sync"

interface MaimemoSyncValue {
  sync: () => void
  isSyncing: boolean
  cooldownRemaining: number
}

const MaimemoSyncContext = createContext<MaimemoSyncValue | null>(null)

/**
 * Single owner of the Maimemo sync mutation + 30s cooldown so TopBar and
 * Dashboard share one clock and never double-toast.
 */
export function MaimemoSyncProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  const cooldownRemaining = Math.max(
    0,
    Math.ceil((cooldownUntil - now) / 1000)
  )

  useEffect(() => {
    if (cooldownRemaining <= 0) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [cooldownRemaining])

  const mutation = useMutation({
    mutationFn: () => api.syncMaimemo(),
    meta: { silent: true },
    onSuccess: (result) => {
      setCooldownUntil(Date.now() + SYNC_COOLDOWN_MS)
      setNow(Date.now())
      queryClient.invalidateQueries({ queryKey: queryKeys.vocab.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.generate.all })
      toast.success(result.cached ? "同步结果已复用" : "同步完成", {
        description: `${result.records_inserted} 新增，${result.records_updated} 更新。`,
      })
      if (result.warning) {
        toast.warning("同步完成但有未取回记录", {
          description: result.warning,
        })
      }
    },
    onError: (error) => {
      toastError("同步失败", error, "请检查后端和 MAIMEMO_TOKEN。")
    },
  })

  const sync = useCallback(() => {
    mutation.mutate()
  }, [mutation])

  const value = useMemo(
    () => ({
      sync,
      isSyncing: mutation.isPending,
      cooldownRemaining,
    }),
    [sync, mutation.isPending, cooldownRemaining]
  )

  return (
    <MaimemoSyncContext.Provider value={value}>
      {children}
    </MaimemoSyncContext.Provider>
  )
}

export function useMaimemoSync(): MaimemoSyncValue {
  const ctx = useContext(MaimemoSyncContext)
  if (!ctx) {
    throw new Error("useMaimemoSync must be used within MaimemoSyncProvider")
  }
  return ctx
}
