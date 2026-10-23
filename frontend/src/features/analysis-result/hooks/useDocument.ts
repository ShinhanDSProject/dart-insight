import { useCallback } from 'react'
import { getDocumentOutline, getSection, type DocumentSide } from '@/shared/api/documents'
import { useAsync } from '@/shared/hooks/useAsync'

/** 한쪽 보고서 원문의 목차(3.5) */
export function useDocumentOutline(analysisId: number, side: DocumentSide) {
  const load = useCallback((signal: AbortSignal) => getDocumentOutline(analysisId, side, signal), [analysisId, side])
  return useAsync(load)
}

/** 원문 한 항목의 문단·표 */
export function useSection(analysisId: number, side: DocumentSide, sectionNo: number) {
  const load = useCallback(
    (signal: AbortSignal) => getSection(analysisId, side, sectionNo, signal),
    [analysisId, side, sectionNo],
  )
  return useAsync(load)
}
