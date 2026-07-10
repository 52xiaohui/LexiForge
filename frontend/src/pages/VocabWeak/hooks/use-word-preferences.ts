import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { toastError } from "@/lib/errors"
import { api } from "@/lib/api"
import { queryKeys } from "@/lib/query-keys"
import type { VocabWord } from "@/types/api"

export function useWordPreferences(options?: {
  onSettledWord?: (word: VocabWord) => void
}) {
  const queryClient = useQueryClient()

  const markMastered = useMutation({
    mutationFn: async (word: VocabWord) => {
      const wordId = word.word_id
      if (!wordId) throw new Error("缺少单词 ID，无法标记掌握")
      await api.markWordMastered(wordId, true)
      return word
    },
    meta: { silent: true },
    onSuccess: (word) => {
      options?.onSettledWord?.(word)
      queryClient.invalidateQueries({ queryKey: queryKeys.vocab.all })
      toast("已标记为掌握", {
        description: `「${word.spelling}」从薄弱词中移除`,
        duration: 6000,
      })
    },
    onError: (error) => {
      toastError("标记掌握失败", error)
    },
  })

  const ignoreWord = useMutation({
    mutationFn: async (word: VocabWord) => {
      await api.markWordIgnored(word.id, true)
      return word
    },
    meta: { silent: true },
    onSuccess: (word) => {
      options?.onSettledWord?.(word)
      queryClient.invalidateQueries({ queryKey: queryKeys.vocab.all })
      toast("已忽略", {
        description: `「${word.spelling}」不会再进入自动选词`,
        duration: 6000,
        action: {
          label: "撤销",
          onClick: () => {
            void api.markWordIgnored(word.id, false).then(() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.vocab.all })
            })
          },
        },
      })
    },
    onError: (error) => {
      toastError("忽略失败", error)
    },
  })

  return { markMastered, ignoreWord }
}
