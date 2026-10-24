import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from '@/app/router'
import { AuthProvider } from '@/shared/auth/AuthProvider'
import '@/shared/styles/tokens.css'
import '@/shared/styles/global.css'
import '@/shared/ui/ui.css'
import '@/shared/styles/print.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
