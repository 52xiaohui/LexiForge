import { useState, type ReactNode } from "react"
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query"
import { toast } from "sonner"

import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MaimemoSyncProvider } from "@/hooks/use-maimemo-sync"
import { errorMessage } from "@/lib/errors"

export function Providers({ children }: { children: ReactNode }) {
  // Single QueryClient instance per mount, shared MutationCache / QueryCache
  // route every failure through the global toaster unless a mutation opts out
  // by setting `meta.silent`.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
        queryCache: new QueryCache({
          onError: (error, query) => {
            if (query.meta?.silent) return
            toast.error("加载失败", {
              description: errorMessage(error),
            })
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            if (mutation.meta?.silent) return
            toast.error("操作失败", {
              description: errorMessage(error),
            })
          },
        }),
      }),
  )

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MaimemoSyncProvider>
          <TooltipProvider delayDuration={150}>
            {children}
            <Toaster />
          </TooltipProvider>
        </MaimemoSyncProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
