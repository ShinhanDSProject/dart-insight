import { useEffect, useRef, useState } from 'react'

export const DEFAULT_MIN_LOADING_MS = 1000

function isTestEnv(): boolean {
  return typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test'
}

/**
 * 로딩 상태(status: 'loading' 또는 loading: true)가 너무 빠르게 끝나는 경우(예: 캐시로 5~20ms만에 완료),
 * 애니메이션이 깜빡이고 사라지는 문제를 방지하기 위해 최소 노출 시간(기본 1000ms)을 보장합니다.
 * 테스트 환경(MODE === 'test')에서는 기본적으로 0ms로 동작하여 테스트 지연 및 타임아웃을 방지합니다.
 */
export function useMinimumLoadingState<S extends { status: string }>(
  state: S,
  minDurationMs = DEFAULT_MIN_LOADING_MS,
  forceInTest = false,
): S {
  const effectiveMs = !forceInTest && isTestEnv() ? 0 : minDurationMs
  const [displayedState, setDisplayedState] = useState<S>(state)
  const loadingStartTimeRef = useRef<number | null>(state.status === 'loading' ? Date.now() : null)
  const latestStateRef = useRef<S>(state)
  latestStateRef.current = state

  useEffect(() => {
    if (state.status === 'loading') {
      if (loadingStartTimeRef.current === null) {
        loadingStartTimeRef.current = Date.now()
      }
      setDisplayedState(state)
      return
    }

    if (loadingStartTimeRef.current !== null && effectiveMs > 0) {
      const elapsed = Date.now() - loadingStartTimeRef.current
      const remaining = effectiveMs - elapsed

      if (remaining > 0) {
        const timer = setTimeout(() => {
          loadingStartTimeRef.current = null
          setDisplayedState(latestStateRef.current)
        }, remaining)
        return () => clearTimeout(timer)
      }
    }

    loadingStartTimeRef.current = null
    setDisplayedState(latestStateRef.current)
  }, [state.status, effectiveMs]) // eslint-disable-line react-hooks/exhaustive-deps

  return displayedState
}

export function useMinimumLoading(
  loading: boolean,
  minDurationMs = DEFAULT_MIN_LOADING_MS,
  forceInTest = false,
): boolean {
  const effectiveMs = !forceInTest && isTestEnv() ? 0 : minDurationMs
  const [displayedLoading, setDisplayedLoading] = useState<boolean>(loading)
  const loadingStartTimeRef = useRef<number | null>(loading ? Date.now() : null)

  useEffect(() => {
    if (loading) {
      if (loadingStartTimeRef.current === null) {
        loadingStartTimeRef.current = Date.now()
      }
      setDisplayedLoading(true)
      return
    }

    if (loadingStartTimeRef.current !== null && effectiveMs > 0) {
      const elapsed = Date.now() - loadingStartTimeRef.current
      const remaining = effectiveMs - elapsed

      if (remaining > 0) {
        const timer = setTimeout(() => {
          loadingStartTimeRef.current = null
          setDisplayedLoading(false)
        }, remaining)
        return () => clearTimeout(timer)
      }
    }

    loadingStartTimeRef.current = null
    setDisplayedLoading(false)
  }, [loading, effectiveMs])

  return displayedLoading
}
