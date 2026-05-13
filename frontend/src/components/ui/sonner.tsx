import { Toaster as SonnerToaster } from "sonner"

import { useTheme } from "@/components/theme-provider"

/**
 * shadcn-style Sonner wrapper. Inherits the app theme so toasts stay on-brand
 * in both light and dark mode, and maps Sonner slots to our design tokens.
 */
export function Toaster(props: React.ComponentProps<typeof SonnerToaster>) {
  const { resolvedTheme } = useTheme()

  return (
    <SonnerToaster
      theme={resolvedTheme}
      position="bottom-right"
      closeButton
      richColors={false}
      toastOptions={{
        classNames: {
          toast:
            "group/toast rounded-2xl border border-border/60 bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/5",
          title: "font-heading text-sm font-medium",
          description: "text-xs text-muted-foreground",
          actionButton:
            "rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background transition-colors hover:bg-foreground/80",
          cancelButton:
            "rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/70",
          closeButton:
            "rounded-full border border-border/60 bg-background text-foreground",
        },
      }}
      {...props}
    />
  )
}
