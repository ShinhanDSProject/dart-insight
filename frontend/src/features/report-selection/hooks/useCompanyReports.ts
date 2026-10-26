import { useCallback } from 'react'
import { listReports } from '@/shared/api/reports'
import { useAsync } from '@/shared/hooks/useAsync'

/** 정기보고서 목록(보고서 비교 탭). 기업 정보는 화면 머리에서 따로 불러온다(useCompany) */
export function useCompanyReports(corpCode: string) {
  const load = useCallback((signal: AbortSignal) => listReports(corpCode, signal), [corpCode])
  return useAsync(load)
}
