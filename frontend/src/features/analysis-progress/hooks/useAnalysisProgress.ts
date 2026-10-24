import { useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { getAnalysis, type Analysis } from '@/shared/api/analyses'
import { usePolling } from '@/shared/hooks/usePolling'
import { analysisPolling } from '../model/progress'

interface Options {
  /** 분석이 완료·실패한 순간 한 번 부른다. 결과 화면으로 옮기기 전에 불린다(4.3 알림) */
  onSettled?: (analysis: Analysis) => void
}

/**
 * 분석 상태를 주기적으로 묻는다(W-02). 완료되면 결과 화면(W-03)으로 옮긴다.
 * 다시 요청해 다른 분석으로 옮겨 오면 처음부터 다시 묻고 이전 분석의 화면을 지운다.
 */
export function useAnalysisProgress(analysisId: string, { onSettled }: Options = {}) {
  const navigate = useNavigate()
  const load = useCallback((signal: AbortSignal) => getAnalysis(analysisId, signal), [analysisId])
  const { state, restart } = usePolling(load, analysisPolling)

  const settled =
    state.status === 'success' && (state.data.status === 'COMPLETED' || state.data.status === 'FAILED')
      ? state.data
      : null
  const settledKey = settled === null ? null : `${settled.analysisId}:${settled.status}`
  // 최신 값을 아래 효과에서 읽는다. 효과는 적은 순서대로 돌므로 먼저 갱신된다
  const latest = useRef({ settled, onSettled })
  useEffect(() => {
    latest.current = { settled, onSettled }
  })

  useEffect(() => {
    const { settled: analysis, onSettled: notify } = latest.current
    if (settledKey === null || analysis === null) return
    notify?.(analysis)
    if (analysis.status === 'COMPLETED') navigate(`/analyses/${analysis.analysisId}`, { replace: true })
  }, [settledKey, navigate])

  return { state, restart }
}
