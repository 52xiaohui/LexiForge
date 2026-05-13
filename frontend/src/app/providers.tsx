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

function messageOf(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  return fallback
}

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
              description: messageOf(error, "请稍后再试。"),
            })
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            if (mutation.meta?.silent) return
            toast.error("操作失败", {
              description: messageOf(error, "请稍后再试。"),
            })
          },
        }),
      }),
  )

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={150}>
          {children}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
