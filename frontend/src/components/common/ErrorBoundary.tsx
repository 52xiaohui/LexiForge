import { RefreshIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Component, type ErrorInfo, type ReactNode } from "react"
import { Link } from "react-router-dom"

import { StatusPanel } from "@/components/common/StatusPanel"
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
        <StatusPanel
          icon={RefreshIcon}
          tone="destructive"
          title="页面出了点问题"
          description={error.message || "未知错误。可以重试，或者先回到总览。"}
          action={
            <>
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
            </>
          }
        />
      )
    }

    return this.props.children
  }
}
