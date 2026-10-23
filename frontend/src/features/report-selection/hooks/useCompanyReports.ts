import { useCallback } from 'react'
import { getCompany, type Company } from '@/shared/api/companies'
import { listReports, type ReportList } from '@/shared/api/reports'
import { useAsync } from '@/shared/hooks/useAsync'

/** 기업 정보와 정기보고서 목록을 함께 불러온다 */
export function useCompanyReports(corpCode: string) {
  const load = useCallback(
    async (signal: AbortSignal): Promise<{ company: Company; reports: ReportList }> => {
      const [company, reports] = await Promise.all([getCompany(corpCode, signal), listReports(corpCode, signal)])
      return { company, reports }
    },
    [corpCode],
  )
  return useAsync(load)
}
