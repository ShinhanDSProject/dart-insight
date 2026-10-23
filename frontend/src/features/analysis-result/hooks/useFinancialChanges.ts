import { useCallback, useState } from 'react'
import { getFinancialChange, getFinancialChanges, type SjDiv, type StatementSummary } from '@/shared/api/results'
import { useAsync } from '@/shared/hooks/useAsync'

/**
 * 재무제표 하나의 계정별 결과(3.1). statements는 마지막으로 받은 재무제표별 개수로,
 * 다시 불러오는 동안에도 고르기 상자를 그대로 두어 키보드 초점을 잃지 않게 한다.
 */
export function useFinancialChanges(analysisId: number, sjDiv: SjDiv, changedOnly: boolean) {
  const load = useCallback(
    (signal: AbortSignal) => getFinancialChanges(analysisId, sjDiv, changedOnly, signal),
    [analysisId, sjDiv, changedOnly],
  )
  const { state, reload } = useAsync(load)
  const [statements, setStatements] = useState<StatementSummary[]>([])
  if (state.status === 'success' && state.data.statements !== statements) {
    setStatements(state.data.statements)
  }
  return { state, reload, statements }
}

/** 계정 하나의 수치 근거(3.3) */
export function useFinancialChangeDetail(analysisId: number, changeId: number) {
  const load = useCallback((signal: AbortSignal) => getFinancialChange(analysisId, changeId, signal), [analysisId, changeId])
  return useAsync(load)
}
