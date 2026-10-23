import { useMemo } from 'react'
import { getReportPair, type ComparisonBasis } from '@/shared/api/reports'
import { useAsync, type Loader } from '@/shared/hooks/useAsync'
import { lookupFor, pairKey, type PairFound, type PairLookup } from '../model/pairSelection'

/** 비교 기준(전년 동기·직전 기간)에 맞는 비교 보고서를 서버에서 찾는다. 직접 선택이거나 현재 보고서가 없으면 찾지 않는다 */
export function usePairLookup(
  corpCode: string,
  basis: ComparisonBasis,
  currentNo: string | null,
): { lookup: PairLookup; retry: () => void } {
  const load = useMemo((): Loader<PairFound> | null => {
    if (basis === 'CUSTOM' || currentNo === null) return null
    return async (signal) => {
      const pair = await getReportPair(corpCode, basis, currentNo, signal)
      return { key: pairKey(basis, currentNo), previous: pair.previous, reason: pair.reason?.message ?? null }
    }
  }, [corpCode, basis, currentNo])
  const { state, reload } = useAsync(load)
  return { lookup: lookupFor(state, pairKey(basis, currentNo)), retry: reload }
}
