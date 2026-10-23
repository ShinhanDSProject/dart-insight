import { useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { applyParamChanges, type ParamChanges } from '@/shared/lib/searchParams'

/**
 * 주소(?...)에 두는 화면 상태(ST-6). update는 바꿀 값만 받고(null이면 지움), 뒤로 가기 기록을 늘리지 않는다(replace).
 */
export function useQueryParams(): { params: URLSearchParams; update: (changes: ParamChanges) => void } {
  const [params, setParams] = useSearchParams()
  const update = useCallback(
    (changes: ParamChanges) => setParams((prev) => applyParamChanges(prev, changes), { replace: true }),
    [setParams],
  )
  return { params, update }
}
