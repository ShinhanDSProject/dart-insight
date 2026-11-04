import { useEffect, useSyncExternalStore } from 'react'
import {
  CURRENT_COMPANY_CHANGE_EVENT,
  CURRENT_COMPANY_KEY,
  loadRecentCompanies,
  nextRecentCompanies,
  saveRecentCompanies,
  type CompanyVisit,
  type CurrentCompany,
} from '@/shared/lib/currentCompany'
import { browserStorage } from '@/shared/lib/recentAnalyses'

// 저장소를 쓸 수 없는 브라우저에서는 이번 방문 동안만 기억한다. 같은 값이면 같은 객체를 돌려줘야 해서 글로 비교한다
let sessionValue: CurrentCompany[] = []
let snapshot: { key: string; value: CurrentCompany[] } = { key: '[]', value: [] }

function getCurrent(): CurrentCompany[] {
  const stored = loadRecentCompanies(browserStorage())
  const value = stored.length > 0 ? stored : sessionValue
  const key = JSON.stringify(value)
  if (key !== snapshot.key) snapshot = { key, value }
  return snapshot.value
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CURRENT_COMPANY_KEY) onChange()
  }
  window.addEventListener(CURRENT_COMPANY_CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CURRENT_COMPANY_CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

/** 상단 '최근 본 기업'(#502, #652). 가장 최근 기업이 맨 앞이다. 같은 탭의 다른 화면과 다른 탭에서 바꾼 것도 따라간다 */
export function useRecentCompanies(): CurrentCompany[] {
  return useSyncExternalStore(subscribe, getCurrent)
}

/** 기업 화면·분석 결과를 열면 그 기업을 '최근 본 기업' 맨 앞에 둔다 */
export function useRecordCurrentCompany(visit: CompanyVisit): void {
  const { corpCode, corpName, stockCode, analysisId } = visit
  useEffect(() => {
    const next = nextRecentCompanies(getCurrent(), { corpCode, corpName, stockCode, analysisId })
    sessionValue = next
    saveRecentCompanies(browserStorage(), next)
    window.dispatchEvent(new Event(CURRENT_COMPANY_CHANGE_EVENT))
  }, [corpCode, corpName, stockCode, analysisId])
}
