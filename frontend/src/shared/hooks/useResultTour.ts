import { useCallback, useSyncExternalStore } from 'react'
import { RESULT_TOUR_CHANGE_EVENT, RESULT_TOUR_SEEN_KEY, readResultTourSeen, resultTourSeen, saveResultTourSeen } from '@/shared/lib/resultTour'
import { browserStorage } from '@/shared/lib/recentAnalyses'

export interface ResultTourController {
  /** 아직 보지 않았으면 true */
  visible: boolean
  /** 끝내거나 건너뛰면 다시 띄우지 않는다 */
  finish: () => void
  /** 이용 안내의 '둘러보기 다시 보기' */
  reopen: () => void
}

// 이번 방문에 정한 값(null이면 아직 안 정함). 저장에 실패해도 이 값으로 닫고 연다(화면을 옮겨도 유지되도록 모듈에 둔다)
let sessionSeen: boolean | null = null

function getSeen(): boolean {
  return resultTourSeen(sessionSeen, readResultTourSeen(browserStorage()))
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== RESULT_TOUR_SEEN_KEY) return
    // 다른 탭에서 바꾼 값을 따르도록 이 탭에서 정한 값을 잊는다(저장된 값이 다시 기준이 된다)
    sessionSeen = null
    onChange()
  }
  window.addEventListener(RESULT_TOUR_CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(RESULT_TOUR_CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

function setSeen(seen: boolean): void {
  sessionSeen = seen
  saveResultTourSeen(browserStorage(), seen)
  window.dispatchEvent(new Event(RESULT_TOUR_CHANGE_EVENT))
}

/** 결과 화면 첫 방문 둘러보기(#842)를 봤는지. 같은 탭의 다른 곳(이용 안내)과 다른 탭에서 바꾼 것도 따라간다 */
export function useResultTour(): ResultTourController {
  const seen = useSyncExternalStore(subscribe, getSeen)
  const finish = useCallback(() => setSeen(true), [])
  const reopen = useCallback(() => setSeen(false), [])
  return { visible: !seen, finish, reopen }
}
