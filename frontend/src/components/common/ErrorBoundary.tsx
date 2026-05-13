import { AlertCircleIcon, RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Component, type ErrorInfo, type ReactNode } from "react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches render-time errors in the route tree. Keeps the app shell alive and
 * gives the user a visible reset + "go home" escape hatch.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Plug in telemetry here when the backend is wired. For now only log.
    console.error("[ErrorBoundary]", error, info.componentStack)
  }

  reset = (): void => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (error) {
      if (this.props.fallback) {
        return this.props.fallback(error, this.reset)
      }
      return (
        <div className="grid min-h-[60vh] place-items-center px-6">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-6 grid size-14 place-items-center rounded-3xl bg-destructive/10 text-destructive">
              <HugeiconsIcon
                icon={AlertCircleIcon}
                size={22}
                strokeWidth={1.6}
              />
            </div>
            <div className="font-heading text-2xl font-semibold tracking-tight">
              页面出了点问题
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {error.message || "未知错误。可以重试，或者先回到总览。"}
            </p>
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={this.reset}>
                <HugeiconsIcon
                  icon={RefreshIcon}
                  data-icon="inline-start"
                  strokeWidth={1.8}
                />
                重试
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard">回到总览</Link>
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
