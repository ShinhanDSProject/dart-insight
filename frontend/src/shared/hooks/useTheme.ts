import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  THEME_CHANGE_EVENT,
  THEME_KEY,
  applyThemeChoice,
  readThemeChoice,
  saveThemeChoice,
  type ThemeChoice,
} from '@/shared/lib/theme'
import { browserStorage } from '@/shared/lib/recentAnalyses'

export interface ThemeController {
  choice: ThemeChoice
  setChoice: (choice: ThemeChoice) => void
}

// 저장소를 쓸 수 없는 브라우저에서는 이번 방문 동안만 기억한다
let sessionChoice: ThemeChoice = 'system'

function getChoice(): ThemeChoice {
  return readThemeChoice(browserStorage()) ?? sessionChoice
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === THEME_KEY) onChange()
  }
  window.addEventListener(THEME_CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

function saveChoice(choice: ThemeChoice): void {
  sessionChoice = choice
  saveThemeChoice(browserStorage(), choice)
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
}

/**
 * 화면 테마(FS-16) 선택. 고른 값을 저장하고 <html data-theme>에 적용한다.
 * 첫 적용은 index.html의 인라인 스크립트가 하고, 이 훅은 바꿀 때와 다른 탭에서 바꾼 것을 따라간다.
 */
export function useTheme(): ThemeController {
  const choice = useSyncExternalStore(subscribe, getChoice)
  useEffect(() => {
    applyThemeChoice(document.documentElement, choice)
  }, [choice])
  const setChoice = useCallback((next: ThemeChoice) => saveChoice(next), [])
  return { choice, setChoice }
}
