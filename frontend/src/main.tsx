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
    document.documentElement.style.setProperty('--intro-drift', `${handoff.driftMs}ms`)
    // 넘어온 직후 2초 동안 생기는 한 번짜리 등장 움직임(페이지·배경 선 등)은 바로 끝낸다. 예시 문구 회전 같은 반복 움직임은 그대로 둔다
    const until = performance.now() + 2000
    const finishEntrance = () => {
      for (const animation of document.getAnimations()) {
        if (animation.effect?.getTiming().iterations !== Infinity) animation.finish()
      }
      if (performance.now() < until) requestAnimationFrame(finishEntrance)
    }
    requestAnimationFrame(finishEntrance)
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
