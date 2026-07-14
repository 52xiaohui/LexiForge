import {
  Key01Icon,
  Loading02Icon,
  SquareLock01Icon,
  ViewIcon,
  ViewOffSlashIcon,
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
  const [showToken, setShowToken] = useState(false)

  const checkSession = useCallback(async () => {
    setStatus("checking")
    setError(null)
    try {
      await api.checkSession()
      setStatus("unlocked")
    } catch (cause) {
      setStatus("locked")
      if (!isAccessDeniedError(cause)) {
        setError("无法连接到 LexiForge API，请检查后端状态与网络后重试。")
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
      setShowToken(false)
      setStatus("unlocked")
    } catch (cause) {
      setError(
        isAccessDeniedError(cause)
          ? "访问令牌不正确。请核对服务器环境变量 APP_ACCESS_TOKEN。"
          : "暂时无法验证令牌，请检查后端连接后重试。"
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
          单用户访问保护。令牌只保存在本浏览器的会话里，关闭标签页后需重新输入。
        </p>

        <div className="mt-8 space-y-2 border-t border-border pt-6">
          <Label htmlFor="access-token">访问令牌</Label>
          <div className="relative">
            <Input
              id="access-token"
              type={showToken ? "text" : "password"}
              autoComplete="current-password"
              spellCheck={false}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              onPaste={(event) => {
                const text = event.clipboardData.getData("text")
                if (text.trim()) {
                  event.preventDefault()
                  setToken(text.trim())
                }
              }}
              aria-invalid={Boolean(error)}
              placeholder="粘贴 APP_ACCESS_TOKEN"
              className="pr-10 font-mono text-sm"
              autoFocus
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
              aria-label={showToken ? "隐藏令牌" : "显示令牌"}
              onClick={() => setShowToken((v) => !v)}
            >
              <HugeiconsIcon
                icon={showToken ? ViewOffSlashIcon : ViewIcon}
                strokeWidth={1.8}
              />
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <p className="text-xs leading-relaxed text-muted-foreground">
            令牌来自后端环境变量{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              APP_ACCESS_TOKEN
            </code>
            （部署机上的{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              1panel.env
            </code>{" "}
            或等价配置），不是墨墨 / OpenAI 的 key。
          </p>
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
