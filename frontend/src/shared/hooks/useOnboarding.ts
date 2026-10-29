import { useCallback, useSyncExternalStore } from 'react'
import {
  ONBOARDING_CHANGE_EVENT,
  ONBOARDING_DISMISSED_KEY,
  onboardingDismissed,
  readOnboardingDismissed,
  saveOnboardingDismissed,
} from '@/shared/lib/onboarding'
import { browserStorage } from '@/shared/lib/recentAnalyses'

export interface OnboardingController {
  /** 닫지 않았으면 true(검색어 조건은 화면이 더한다) */
  visible: boolean
  dismiss: () => void
  /** 닫은 표시를 지워 다시 보이게 한다(첫 화면 '사용법 보기') */
  reopen: () => void
}

// 저장소를 쓸 수 없는 브라우저에서는 이번 방문 동안만 기억한다(화면을 옮겨도 유지되도록 모듈에 둔다)
let sessionDismissed = false

function getDismissed(): boolean {
  return onboardingDismissed(readOnboardingDismissed(browserStorage()), sessionDismissed)
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === ONBOARDING_DISMISSED_KEY) onChange()
  }
  window.addEventListener(ONBOARDING_CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(ONBOARDING_CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

function setDismissed(dismissed: boolean): void {
  sessionDismissed = dismissed
  saveOnboardingDismissed(browserStorage(), dismissed)
  // 같은 탭의 다른 곳도 같은 값을 보도록 알린다
  window.dispatchEvent(new Event(ONBOARDING_CHANGE_EVENT))
}

/** 처음 쓰는 사용자 안내(FS-10)를 닫고 다시 여는 상태. 같은 탭의 다른 곳과 다른 탭에서 바꾼 것도 따라간다 */
export function useOnboarding(): OnboardingController {
  const dismissed = useSyncExternalStore(subscribe, getDismissed)
  const dismiss = useCallback(() => setDismissed(true), [])
  const reopen = useCallback(() => setDismissed(false), [])
  return { visible: !dismissed, dismiss, reopen }
}
