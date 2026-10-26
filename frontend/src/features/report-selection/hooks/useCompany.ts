import { useCallback } from 'react'
import { getCompany } from '@/shared/api/companies'
import { useAsync } from '@/shared/hooks/useAsync'

/** 기업 화면 머리(회사명·종목코드)에 쓰는 기업 정보. 저장된 기업 목록만 읽는다(OpenDART를 부르지 않음) */
export function useCompany(corpCode: string) {
  const load = useCallback((signal: AbortSignal) => getCompany(corpCode, signal), [corpCode])
  return useAsync(load)
}
