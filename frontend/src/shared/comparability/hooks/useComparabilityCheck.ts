import { useMemo } from 'react'
import { checkComparability, type ComparabilityRequest, type ComparabilityResult } from '@/shared/api/comparability'
import { useAsync, type Loader } from '@/shared/hooks/useAsync'

/** 두 보고서를 비교할 수 있는지 확인한다(2.2). 두 보고서가 다 정해지지 않았으면 확인하지 않는다(idle) */
export function useComparabilityCheck({ corpCode, currentRceptNo, previousRceptNo, basis }: ComparabilityRequest) {
  const load = useMemo((): Loader<ComparabilityResult> | null => {
    if (currentRceptNo === '' || previousRceptNo === '') return null
    return (signal) => checkComparability({ corpCode, currentRceptNo, previousRceptNo, basis }, signal)
  }, [corpCode, currentRceptNo, previousRceptNo, basis])
  return useAsync(load)
}
