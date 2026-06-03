/**
 * Dev-only query-state simulator.
 *
 * The prototype's mock queries resolve synchronously, so loading / error /
 * empty states are effectively invisible. Append a `?sim=` query param to make
 * the wrapped queries reproduce a given state — useful for designing and
 * screenshotting the state system on the deploy preview.
 *
 *   ?sim=loading  → never resolves (shows the skeleton)
 *   ?sim=error    → rejects (shows the error state + global toast)
 *   ?sim=empty    → resolves with the provided empty value (shows the empty state)
 *
 * With no `sim` param the wrapper is a no-op, so production behaviour is
 * unchanged.
 */

type SimState = "loading" | "error" | "empty"

function currentSim(): SimState | null {
  if (typeof window === "undefined") return null
  const value = new URLSearchParams(window.location.search).get("sim")
  if (value === "loading" || value === "error" || value === "empty") {
    return value
  }
  return null
}

const SIM_ERROR_MESSAGE = "模拟加载失败：请稍后重试"

/**
 * Wraps a queryFn so it honours the `?sim=` param. Pass `emptyValue` to support
 * `?sim=empty` for list-shaped queries.
 */
export function withSim<T>(
  queryFn: () => Promise<T>,
  options?: { emptyValue?: T },
): () => Promise<T> {
  return async () => {
    const sim = currentSim()
    if (sim === "error") {
      throw new Error(SIM_ERROR_MESSAGE)
    }
    if (sim === "loading") {
      // Hang indefinitely so the pending UI stays visible for inspection.
      await new Promise<never>(() => {})
    }
    if (sim === "empty" && options && "emptyValue" in options) {
      return options.emptyValue as T
    }
    return queryFn()
  }
}
