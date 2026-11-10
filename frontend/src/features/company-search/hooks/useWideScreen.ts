import { useSyncExternalStore } from 'react'
import { WIDE_SCREEN_QUERY } from '../model/homeLists'

function query(): MediaQueryList | null {
  return typeof window === 'undefined' || !window.matchMedia ? null : window.matchMedia(WIDE_SCREEN_QUERY)
}

function subscribe(onChange: () => void): () => void {
  const list = query()
  list?.addEventListener('change', onChange)
  return () => list?.removeEventListener('change', onChange)
}

/** 첫 화면을 넓게 보일 큰 화면(#852)인지. 알 수 없으면(테스트 등) 좁은 화면으로 본다 */
export function useWideScreen(): boolean {
  return useSyncExternalStore(subscribe, () => query()?.matches ?? false)
}
