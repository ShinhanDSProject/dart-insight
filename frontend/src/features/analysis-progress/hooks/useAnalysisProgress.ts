import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { getAnalysis, type Analysis } from '@/shared/api/analyses'
import { usePolling } from '@/shared/hooks/usePolling'
import { analysisPolling } from '../model/progress'

interface Options {
  /** 분석이 완료·실패한 순간 한 번 부른다. 결과 화면으로 옮기기 전에 불린다(4.3 알림) */
  onSettled?: (analysis: Analysis) => void
  /**
   * 화면 진입 후 결과 화면으로 전환되기 전까지의 최소 노출 시간 (ms).
   * 이미 캐시된 분석의 경우 너무 빠르게 넘어가 동적 애니메이션이 생략되는 것을 방지합니다.
   */
  minProgressDisplayMs?: number
  /**
   * 분석 진행 중 완료(COMPLETED) 상태에 도달했을 때 완료 상태(100% 게이지 및 축하)를 보여줄 최소 시간 (ms).
   */
  minCompletedDisplayMs?: number
}

function isTestEnv(): boolean {
  return typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test'
}

const DEFAULT_MIN_PROGRESS_MS = isTestEnv() ? 0 : 1400
const DEFAULT_MIN_COMPLETED_MS = isTestEnv() ? 0 : 1000

/**
 * 분석 상태를 주기적으로 묻는다(W-02). 완료되면 적절한 시간을 두고 부드럽게 결과 화면(W-03)으로 옮긴다.
 * 다시 요청해 다른 분석으로 옮겨 오면 처음부터 다시 묻고 이전 분석의 화면을 지운다.
 */
export function useAnalysisProgress(
  analysisId: string,
  {
    onSettled,
    minProgressDisplayMs = DEFAULT_MIN_PROGRESS_MS,
    minCompletedDisplayMs = DEFAULT_MIN_COMPLETED_MS,
  }: Options = {},
) {
  const navigate = useNavigate()
  const load = useCallback((signal: AbortSignal) => getAnalysis(analysisId, signal), [analysisId])
  const { state, restart } = usePolling(load, analysisPolling)

  const settled =
    state.status === 'success' && (state.data.status === 'COMPLETED' || state.data.status === 'FAILED')
      ? state.data
      : null
  const settledKey = settled === null ? null : `${settled.analysisId}:${settled.status}`
  const mountTimeRef = useRef<number>(Date.now())
  const completionTimeRef = useRef<number | null>(null)

  // 최신 값을 아래 효과에서 읽는다. 효과는 적은 순서대로 돌므로 먼저 갱신된다
  const latest = useRef({ settled, onSettled })
  useEffect(() => {
    latest.current = { settled, onSettled }
  })

  useEffect(() => {
    const { settled: analysis, onSettled: notify } = latest.current
    if (settledKey === null || analysis === null) return
    notify?.(analysis)
    if (analysis.status === 'COMPLETED') {
      if (completionTimeRef.current === null) {
        completionTimeRef.current = Date.now()
      }
      const timeSinceMount = Date.now() - mountTimeRef.current
      const timeSinceCompletion = Date.now() - completionTimeRef.current
      const remainingMount = Math.max(0, minProgressDisplayMs - timeSinceMount)
      const remainingCompletion = Math.max(0, minCompletedDisplayMs - timeSinceCompletion)
      const delay = Math.max(remainingMount, remainingCompletion)

      if (delay === 0) {
        navigate(`/analyses/${analysis.analysisId}`, { replace: true })
        return
      }

      const timer = setTimeout(() => {
        navigate(`/analyses/${analysis.analysisId}`, { replace: true })
      }, delay)
      return () => clearTimeout(timer)
    }
  }, [settledKey, navigate, minProgressDisplayMs, minCompletedDisplayMs])

  return { state, restart }
}
