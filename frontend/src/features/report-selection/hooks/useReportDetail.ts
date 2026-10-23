import { useCallback } from 'react'
import { getReport } from '@/shared/api/reports'
import { useAsync } from '@/shared/hooks/useAsync'

/** 보고서 한 건의 메타데이터(1.3) */
export function useReportDetail(rceptNo: string) {
  const load = useCallback((signal: AbortSignal) => getReport(rceptNo, signal), [rceptNo])
  return useAsync(load)
}
