import { toast } from "sonner"

/** Extract a human-readable message from unknown thrown values. */
export function errorMessage(
  err: unknown,
  fallback = "请稍后再试。"
): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === "string" && err.length > 0) return err
  return fallback
}

/** Standard error toast used across mutations and ad-hoc try/catch. */
export function toastError(
  title: string,
  err: unknown,
  fallback = "请稍后再试。"
): void {
  toast.error(title, {
    description: errorMessage(err, fallback),
  })
}
