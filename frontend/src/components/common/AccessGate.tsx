import {
  Key01Icon,
  Loading02Icon,
  SquareLock01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, isAccessDeniedError } from "@/lib/api"
import {
  ACCESS_TOKEN_REJECTED_EVENT,
  clearAccessToken,
  getAccessToken,
} from "@/lib/access-token"

type GateStatus = "checking" | "locked" | "unlocked"

export function AccessGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GateStatus>("checking")
  const [token, setToken] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const checkSession = useCallback(async () => {
    setStatus("checking")
    setError(null)
    try {
      await api.checkSession()
      setStatus("unlocked")
    } catch (cause) {
      setStatus("locked")
      if (!isAccessDeniedError(cause)) {
        setError("无法连接到 LexiForge API，请检查后端状态后重试。")
      }
    }
  }, [])

  useEffect(() => {
    const reject = () => {
      clearAccessToken()
      setToken("")
      setError("访问令牌已失效，请重新输入。")
      setStatus("locked")
    }
    window.addEventListener(ACCESS_TOKEN_REJECTED_EVENT, reject)
    const initialCheck = window.setTimeout(() => void checkSession(), 0)
    return () => {
      window.clearTimeout(initialCheck)
      window.removeEventListener(ACCESS_TOKEN_REJECTED_EVENT, reject)
    }
  }, [checkSession])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const candidate = token.trim()
    if (!candidate) {
      setError("请输入访问令牌。")
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await api.unlock(candidate)
      setToken("")
      setStatus("unlocked")
    } catch (cause) {
      setError(
        isAccessDeniedError(cause)
          ? "访问令牌不正确。"
          : "暂时无法验证令牌，请检查后端连接。"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (status === "unlocked") return children

  if (status === "checking") {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <HugeiconsIcon
          icon={Loading02Icon}
          size={24}
          strokeWidth={1.8}
          className="animate-spin text-muted-foreground"
          aria-label="正在验证访问权限"
        />
      </div>
    )
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12">
      <form className="w-full max-w-sm" onSubmit={submit}>
        <div className="grid size-12 place-items-center rounded-lg bg-foreground text-background">
          <HugeiconsIcon icon={SquareLock01Icon} size={21} strokeWidth={1.7} />
        </div>
        <h1 className="mt-6 font-heading text-3xl font-semibold tracking-normal">
          LexiForge
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          输入后端配置的单用户访问令牌，解锁当前浏览器会话。
        </p>

        <div className="mt-8 space-y-2 border-t border-border pt-6">
          <Label htmlFor="access-token">访问令牌</Label>
          <Input
            id="access-token"
            type="password"
            autoComplete="current-password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            aria-invalid={Boolean(error)}
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="mt-5 flex gap-2">
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            <HugeiconsIcon
              icon={isSubmitting ? Loading02Icon : Key01Icon}
              data-icon="inline-start"
              strokeWidth={1.8}
              className={isSubmitting ? "animate-spin" : undefined}
            />
            {isSubmitting ? "验证中" : "解锁"}
          </Button>
          {getAccessToken() && (
            <Button type="button" variant="outline" onClick={checkSession}>
              重试
            </Button>
          )}
        </div>
      </form>
    </main>
  )
}
