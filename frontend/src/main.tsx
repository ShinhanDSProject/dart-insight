import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from '@/app/router'
import { AuthProvider } from '@/shared/auth/AuthProvider'
import { INTRO_HANDOFF_KEY, parseIntroHandoff } from '@/shared/lib/introHandoff'
import '@/shared/styles/tokens.css'
import '@/shared/styles/global.css'
import '@/shared/ui/ui.css'
import '@/shared/styles/print.css'

// 발표 페이지의 시연 전환에서 막 넘어왔으면, 장면 속 첫 화면과 이어지게 등장 움직임을 건너뛰고 바탕 흐름 위치를 맞춘다
try {
  const handoff = parseIntroHandoff(sessionStorage.getItem(INTRO_HANDOFF_KEY), Date.now())
  sessionStorage.removeItem(INTRO_HANDOFF_KEY)
  if (handoff) {
    const root = document.documentElement
    root.style.setProperty('--intro-drift', `${handoff.driftMs}ms`)
    root.classList.add('intro-handoff')
    window.setTimeout(() => root.classList.remove('intro-handoff'), 6000)
  }
} catch {
  // 저장소를 쓸 수 없으면 평소처럼 등장 움직임을 보여 준다
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
