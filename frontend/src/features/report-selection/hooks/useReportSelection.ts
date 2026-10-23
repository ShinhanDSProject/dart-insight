import type { ComparisonBasis, ReportItem } from '@/shared/api/reports'
import { useQueryParams } from '@/shared/hooks/useQueryParams'
import { parseBasis } from '@/shared/lib/comparisonBasis'
import { basisChanges, currentChanges, findPrevious } from '../model/pairSelection'
import { usePairLookup } from './usePairLookup'

/**
 * 고른 두 보고서와 비교 기준(주소 ?current=&basis=&previous=, ST-6).
 * items가 없으면(목록을 불러오는 중) 아무것도 고르지 않은 상태다.
 */
export function useReportSelection(corpCode: string, items: ReportItem[] | null) {
  const { params, update } = useQueryParams()
  const current = items ? (items.find((r) => r.rceptNo === params.get('current')) ?? items[0] ?? null) : null
  const basis = parseBasis(params.get('basis'))
  const { lookup, retry } = usePairLookup(corpCode, basis, current?.rceptNo ?? null)
  const previous = items ? findPrevious(items, current, basis, lookup, params.get('previous')) : null

  return {
    current,
    basis,
    previous,
    lookup,
    retryLookup: retry,
    selectCurrent: (rceptNo: string) => update(currentChanges(items ?? [], rceptNo, basis, previous)),
    selectBasis: (nextBasis: ComparisonBasis) => {
      const changes = basisChanges(basis, nextBasis)
      if (changes !== null) update(changes)
    },
    selectPrevious: (rceptNo: string | null) => update({ previous: rceptNo }),
  }
}
