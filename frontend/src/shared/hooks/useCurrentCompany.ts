import { useEffect, useSyncExternalStore } from 'react'
import {
  CURRENT_COMPANY_CHANGE_EVENT,
  CURRENT_COMPANY_KEY,
  loadCurrentCompany,
  nextCurrentCompany,
  saveCurrentCompany,
  type CompanyVisit,
  type CurrentCompany,
} from '@/shared/lib/currentCompany'
import { browserStorage } from '@/shared/lib/recentAnalyses'

// 저장소를 쓸 수 없는 브라우저에서는 이번 방문 동안만 기억한다. 같은 값이면 같은 객체를 돌려줘야 해서 글로 비교한다
let sessionValue: CurrentCompany | null = null
let snapshot: { key: string; value: CurrentCompany | null } = { key: 'null', value: null }

function getCurrent(): CurrentCompany | null {
  const value = loadCurrentCompany(browserStorage()) ?? sessionValue
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

/** 왼쪽 메뉴 '지금 보는 기업'(#502). 같은 탭의 다른 화면과 다른 탭에서 바꾼 것도 따라간다 */
export function useCurrentCompany(): CurrentCompany | null {
  return useSyncExternalStore(subscribe, getCurrent)
}

/** 기업 화면·분석 결과를 열면 '지금 보는 기업'을 그 기업으로 바꾼다 */
export function useRecordCurrentCompany(visit: CompanyVisit): void {
  const { corpCode, corpName, stockCode, analysisId } = visit
  useEffect(() => {
    const next = nextCurrentCompany(getCurrent(), { corpCode, corpName, stockCode, analysisId })
    sessionValue = next
    saveCurrentCompany(browserStorage(), next)
    window.dispatchEvent(new Event(CURRENT_COMPANY_CHANGE_EVENT))
  }, [corpCode, corpName, stockCode, analysisId])
}
