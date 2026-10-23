import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { getAnalysis } from '@/shared/api/analyses'
import { usePolling } from '@/shared/hooks/usePolling'
import { analysisPolling } from '../model/progress'

/**
 * 분석 상태를 주기적으로 묻는다(W-02). 완료되면 결과 화면(W-03)으로 옮긴다.
 * 다시 요청해 다른 분석으로 옮겨 오면 처음부터 다시 묻고 이전 분석의 화면을 지운다.
 */
export function useAnalysisProgress(analysisId: string) {
  const navigate = useNavigate()
  const load = useCallback((signal: AbortSignal) => getAnalysis(analysisId, signal), [analysisId])
  const { state, restart } = usePolling(load, analysisPolling)

  const completedId = state.status === 'success' && state.data.status === 'COMPLETED' ? state.data.analysisId : null
  useEffect(() => {
    if (completedId !== null) navigate(`/analyses/${completedId}`, { replace: true })
  }, [completedId, navigate])

  return { state, restart }
}
