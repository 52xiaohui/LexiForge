import type { LastResponse } from "@/types/api"

export type ResponseFilter = "ALL" | LastResponse

export const LAST_RESPONSE_OPTIONS: {
  value: ResponseFilter
  label: string
}[] = [
  { value: "ALL", label: "全部" },
  { value: "FORGET", label: "遗忘" },
  { value: "VAGUE", label: "模糊" },
  { value: "FAMILIAR", label: "熟悉" },
  { value: "WELL_FAMILIAR", label: "已掌握" },
]

/** Display order used in generation preview breakdown chips. */
export const LAST_RESPONSE_ORDER: LastResponse[] = [
  "FORGET",
  "VAGUE",
  "FAMILIAR",
  "WELL_FAMILIAR",
]
