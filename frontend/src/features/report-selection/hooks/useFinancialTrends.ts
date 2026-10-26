import { useCallback } from 'react'
import { getFinancialTrends, type FsDiv } from '@/shared/api/financialTrends'
import { useAsync } from '@/shared/hooks/useAsync'

/** 최근 정기보고서들의 주요 재무 흐름(FS-46). 기준(연결·별도)이 바뀌면 이전 요청을 취소하고 다시 부른다 */
export function useFinancialTrends(corpCode: string, fsDiv: FsDiv) {
  const load = useCallback((signal: AbortSignal) => getFinancialTrends(corpCode, fsDiv, signal), [corpCode, fsDiv])
  return useAsync(load)
}
