export const SYNC_STALE_HOURS = 24
export const SYNC_COOLDOWN_MS = 30_000

export type SyncStatus = "fresh" | "stale" | "never"

export function computeSyncStatus(
  lastSyncedAt: string | null | undefined
): SyncStatus {
  if (!lastSyncedAt) return "never"
  const diff = Date.now() - new Date(lastSyncedAt).getTime()
  if (diff > SYNC_STALE_HOURS * 60 * 60 * 1000) return "stale"
  return "fresh"
}

export function isSyncStale(
  lastSyncedAt: string | null | undefined
): boolean {
  return computeSyncStatus(lastSyncedAt) !== "fresh"
}
