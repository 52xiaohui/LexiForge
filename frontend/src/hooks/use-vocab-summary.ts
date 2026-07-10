import { useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"

export function useVocabSummary(options?: { silent?: boolean }) {
  return useQuery({
    queryKey: queryKeys.vocab.summary(),
    queryFn: () => api.vocabSummary(),
    meta: options?.silent ? { silent: true } : undefined,
  })
}
