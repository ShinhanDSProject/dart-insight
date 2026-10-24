import { useCallback, useEffect, useState } from 'react'
import {
  addRecentAnalysis,
  browserStorage,
  loadRecentAnalyses,
  removeRecentAnalysis,
  saveRecentAnalyses,
  toRecentAnalysis,
  type RecentAnalysis,
  type RecentAnalysisSource,
} from '@/shared/lib/recentAnalyses'

export interface RecentAnalysesController {
  items: RecentAnalysis[]
  remove: (analysisId: number) => void
  clear: () => void
}

/** 검색 화면의 최근 본 분석 목록(FS-7). 지우면 화면과 저장소를 함께 바꾼다 */
export function useRecentAnalyses(): RecentAnalysesController {
  const [items, setItems] = useState<RecentAnalysis[]>(() => loadRecentAnalyses(browserStorage()))

  const remove = useCallback((analysisId: number) => {
    // 다른 탭에서 바뀌었을 수 있어 저장된 값을 다시 읽어 뺀다
    const next = removeRecentAnalysis(loadRecentAnalyses(browserStorage()), analysisId)
    saveRecentAnalyses(browserStorage(), next)
    setItems(next)
  }, [])

  const clear = useCallback(() => {
    saveRecentAnalyses(browserStorage(), [])
    setItems([])
  }, [])

  return { items, remove, clear }
}

/** 완료된 결과 화면을 열면 그 분석을 최근 본 분석 맨 앞에 남긴다. 같은 분석이면 한 번만 남긴다 */
export function useRecordRecentAnalysis(analysis: RecentAnalysisSource): void {
  const { analysisId, corpName, basis } = analysis
  const previousName = analysis.previous.reportName
  const currentName = analysis.current.reportName
  useEffect(() => {
    const storage = browserStorage()
    const entry = toRecentAnalysis(
      { analysisId, corpName, basis, previous: { reportName: previousName }, current: { reportName: currentName } },
      new Date(),
    )
    saveRecentAnalyses(storage, addRecentAnalysis(loadRecentAnalyses(storage), entry))
  }, [analysisId, corpName, basis, previousName, currentName])
}
