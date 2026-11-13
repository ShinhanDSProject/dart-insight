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

// 발표 페이지의 시연 전환에서 막 넘어왔으면 바탕 점 격자를 장면 속 첫 화면과 같은 위치에서 이어 흐르게 한다.
// 등장 움직임 건너뛰기는 index.html(#from-deck → data-intro="skip")이 맡는다.
try {
  const handoff = parseIntroHandoff(sessionStorage.getItem(INTRO_HANDOFF_KEY), Date.now())
  sessionStorage.removeItem(INTRO_HANDOFF_KEY)
  if (handoff) document.documentElement.style.setProperty('--intro-drift', `${handoff.driftMs}ms`)
} catch {
  // 저장소를 쓸 수 없으면 점 격자는 처음 위치에서 흐른다
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
