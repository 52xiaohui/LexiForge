const STORAGE_KEY = "lexiforge_access_token"

export const ACCESS_TOKEN_REJECTED_EVENT = "lexiforge:access-token-rejected"

export function getAccessToken(): string {
  if (typeof window === "undefined") return ""
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) ?? ""
  } catch {
    return ""
  }
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, token.trim())
  } catch {
    // The in-memory page can still continue even when storage is unavailable.
  }
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing else to clear.
  }
}

export function notifyAccessTokenRejected(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(ACCESS_TOKEN_REJECTED_EVENT))
}
