import { RouterProvider } from "react-router-dom"

import { Providers } from "@/app/providers"
import { router } from "@/app/router"
import { AccessGate } from "@/components/common/AccessGate"

export function App() {
  return (
    <Providers>
      <AccessGate>
        <RouterProvider router={router} />
      </AccessGate>
    </Providers>
  )
}

export default App
