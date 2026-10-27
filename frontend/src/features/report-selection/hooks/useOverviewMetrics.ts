import { useCallback } from 'react'
import { getFinancialTrends } from '@/shared/api/financialTrends'
import { useAsync } from '@/shared/hooks/useAsync'
import { hasMetricValues, overviewMetrics, type OverviewMetrics } from '../model/overviewMetrics'

/**
 * 기업 개요 상단 지표 줄(FS-58). 주요 재무 흐름 API(FS-46)를 그대로 읽는다(새 API 없음).
 * 연결 기준을 먼저 보고, 연결 재무제표가 없는 기업(종속회사 없음 등)이라 값이 하나도 없으면 별도 기준을 본다.
 * 둘 다 없으면 연결 기준 결과(값 없음)를 돌려준다. 조건이 바뀌거나 언마운트하면 요청을 취소한다(useAsync).
 */
export function useOverviewMetrics(corpCode: string) {
  const load = useCallback(
    async (signal: AbortSignal): Promise<OverviewMetrics | null> => {
      const consolidated = overviewMetrics(await getFinancialTrends(corpCode, 'CFS', signal))
      if (hasMetricValues(consolidated)) return consolidated
      const separate = overviewMetrics(await getFinancialTrends(corpCode, 'OFS', signal))
      return hasMetricValues(separate) ? separate : consolidated
    },
    [corpCode],
  )
  return useAsync(load)
}
