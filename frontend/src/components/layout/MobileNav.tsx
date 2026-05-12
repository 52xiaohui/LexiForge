import { useEffect } from "react"
import { useLocation } from "react-router-dom"

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"

import { Sidebar } from "./Sidebar"

export interface MobileNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const location = useLocation()

  useEffect(() => {
    onOpenChange(false)
  }, [location.pathname, onOpenChange])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetTitle className="sr-only">导航菜单</SheetTitle>
        <Sidebar />
      </SheetContent>
    </Sheet>
  )
}
