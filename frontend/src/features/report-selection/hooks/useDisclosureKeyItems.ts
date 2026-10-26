import { useCallback } from 'react'
import { getDisclosureKeyItems } from '@/shared/api/disclosures'
import { useAsync } from '@/shared/hooks/useAsync'

/**
 * 주요사항보고서 한 건의 핵심 수치(FS-51). open이 false면 부르지 않는다(펼칠 때 처음 부름).
 * 닫거나 화면을 떠나면 진행 중인 요청을 취소한다
 */
export function useDisclosureKeyItems(corpCode: string, rceptNo: string, open: boolean) {
  const load = useCallback(
    (signal: AbortSignal) => getDisclosureKeyItems(corpCode, rceptNo, signal),
    [corpCode, rceptNo],
  )
  return useAsync(open ? load : null)
}
