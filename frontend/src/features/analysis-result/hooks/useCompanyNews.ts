import { useCallback } from 'react'
import { getCompanyNews } from '@/shared/api/news'
import { useAsync } from '@/shared/hooks/useAsync'

/** 분석 결과 '뉴스' 탭(#592). 기업이 바뀌거나 다시 시도하면 이전 요청을 취소한다(useAsync) */
export function useCompanyNews(corpCode: string) {
  const load = useCallback((signal: AbortSignal) => getCompanyNews(corpCode, signal), [corpCode])
  return useAsync(load)
}
