import { useCallback } from 'react'
import { getAiUsage, type AiUsageDays } from '@/shared/api/system'
import { useAsync } from '@/shared/hooks/useAsync'
import { useQueryParams } from '@/shared/hooks/useQueryParams'
import { parseDays } from '../model/aiUsage'

/** 고른 기간(?days=, 기본 30일). 주소에 두어 같은 기간으로 공유할 수 있다(ST-6) */
export function useUsageDays(): { days: AiUsageDays; setDays: (days: AiUsageDays) => void } {
  const { params, update } = useQueryParams()
  const days = parseDays(params.get('days'))
  const setDays = useCallback((next: AiUsageDays) => update({ days: next === 30 ? null : String(next) }), [update])
  return { days, setDays }
}

/** AI 사용 현황 집계. 기간을 바꾸면 이전 요청을 취소하고 다시 불러온다 */
export function useAiUsage(days: AiUsageDays) {
  const load = useCallback((signal: AbortSignal) => getAiUsage(days, signal), [days])
  return useAsync(load)
}
