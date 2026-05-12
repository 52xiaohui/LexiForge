import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"

export function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="text-center">
        <div className="font-heading text-5xl font-semibold tracking-tight">404</div>
        <p className="mt-3 text-sm text-muted-foreground">
          这个地址不在 MVP 路由里。
        </p>
        <Button asChild variant="outline" size="sm" className="mt-6">
          <Link to="/dashboard">回到总览</Link>
        </Button>
      </div>
    </div>
  )
}
