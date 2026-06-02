import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// https://vite.dev/config/
export default defineConfig({
  test: {
    environment: "jsdom",
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split the single ~550KB vendor chunk into cacheable groups so a
        // change in app code (or one library) doesn't re-download everything.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined
          if (/[/\\]node_modules[/\\](react|react-dom|react-router|react-router-dom|scheduler)[/\\]/.test(id))
            return "react-vendor"
          if (id.includes("@tanstack")) return "query-vendor"
          if (id.includes("@hugeicons")) return "icons-vendor"
          if (id.includes("@radix-ui") || id.includes("radix-maia")) return "radix-vendor"
          return "vendor"
        },
      },
    },
  },
})
