import { useCallback } from 'react'
import { getSeasonChanges, type SeasonKey } from '@/shared/api/seasonChanges'
import { useAsync } from '@/shared/hooks/useAsync'

/** 첫 화면 이번 시즌 변화가 큰 기업(#420). season이 null이면 계산한 가장 최근 시즌 */
export function useSeasonChanges(season: SeasonKey | null) {
  const reportType = season?.reportType ?? null
  const fiscalYear = season?.fiscalYear ?? null
  const load = useCallback(
    (signal: AbortSignal) =>
      getSeasonChanges(reportType === null || fiscalYear === null ? null : { reportType, fiscalYear }, signal),
    [reportType, fiscalYear],
  )
  return useAsync(load)
}
