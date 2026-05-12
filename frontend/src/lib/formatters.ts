const numberFormatter = new Intl.NumberFormat("en-US")

const dateOnlyFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
})

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function formatCount(n: number): string {
  return numberFormatter.format(n)
}

export function formatCoverage(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) {
    return "—"
  }

  const target = new Date(iso).getTime()
  const now = Date.now()
  const diffSec = Math.round((now - target) / 1000)

  if (diffSec < 60) {
    return "刚刚"
  }

  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) {
    return `${diffMin} 分钟前`
  }

  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) {
    return `${diffHour} 小时前`
  }

  const diffDay = Math.round(diffHour / 24)
  if (diffDay < 30) {
    return `${diffDay} 天前`
  }

  return dateOnlyFormatter.format(new Date(iso))
}

export function formatAbsoluteTime(iso: string | null): string {
  if (!iso) {
    return "—"
  }
  return dateTimeFormatter.format(new Date(iso))
}

const lastResponseLabels: Record<string, string> = {
  FAMILIAR: "熟悉",
  WELL_FAMILIAR: "已掌握",
  VAGUE: "模糊",
  FORGET: "遗忘",
}

export function formatLastResponse(value: string): string {
  return lastResponseLabels[value] ?? value
}

const difficultyLabels: Record<string, string> = {
  A2: "A2 · 初阶",
  B1: "B1 · 中阶",
  B2: "B2 · 中高阶",
  C1: "C1 · 进阶",
}

export function formatDifficulty(value: string): string {
  return difficultyLabels[value] ?? value
}
