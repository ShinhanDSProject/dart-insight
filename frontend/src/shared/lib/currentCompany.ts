/**
 * 왼쪽 메뉴 '지금 보는 기업'(#502). 마지막으로 연 기업·분석을 브라우저(localStorage)에 남겨, 홈에 나갔다가도
 * '공시 비교'·'원문 확인'으로 돌아가게 한다. 서버에는 보내지 않고, 저장을 쓸 수 없으면 이번 방문 동안만 기억한다.
 */
export const CURRENT_COMPANY_KEY = 'dart-insight:current-company'
/** 같은 탭 안에서 바뀐 것을 알리는 이벤트 이름(다른 탭은 storage 이벤트로 안다) */
export const CURRENT_COMPANY_CHANGE_EVENT = 'dart-insight:current-company-change'

export type CurrentCompanyStorage = Pick<Storage, 'getItem' | 'setItem'>

export interface CurrentCompany {
  corpCode: string
  corpName: string
  stockCode: string | null
  /** 이 기업에서 마지막으로 연 분석. 없으면 null('원문 확인'을 숨김) */
  analysisId: number | null
  /** 마지막으로 본 화면. '공시 비교'가 이곳으로 간다 */
  view: 'company' | 'analysis'
}

/** 기업 화면이나 분석 결과를 열었을 때 넘기는 값 */
export interface CompanyVisit {
  corpCode: string
  corpName: string
  stockCode?: string | null
  analysisId?: number | null
}

/**
 * 새로 연 화면으로 '지금 보는 기업'을 바꾼다. 같은 기업이면 모르는 값(종목코드·분석)은 전에 알던 것을 이어 쓰고,
 * 다른 기업이면 전 기업의 분석을 버린다.
 */
export function nextCurrentCompany(previous: CurrentCompany | null, visit: CompanyVisit): CurrentCompany {
  const same = previous !== null && previous.corpCode === visit.corpCode
  const analysisId = visit.analysisId ?? (same ? previous.analysisId : null)
  return {
    corpCode: visit.corpCode,
    corpName: visit.corpName,
    stockCode: visit.stockCode ?? (same ? previous.stockCode : null),
    analysisId,
    view: visit.analysisId != null ? 'analysis' : 'company',
  }
}

/** 기업 개요 화면 주소(?view=overview, #525) */
export function companyOverviewLink(corpCode: string): string {
  return `/companies/${encodeURIComponent(corpCode)}?view=overview`
}

/** '기업 개요'가 갈 곳(#525) */
export function overviewLink(company: CurrentCompany): string {
  return companyOverviewLink(company.corpCode)
}

/** '공시 비교'가 갈 곳: 마지막으로 본 화면이 분석이면 그 분석, 아니면 기업 화면 */
export function compareLink(company: CurrentCompany): string {
  return company.view === 'analysis' && company.analysisId !== null
    ? `/analyses/${company.analysisId}`
    : `/companies/${encodeURIComponent(company.corpCode)}`
}

/** '원문 확인'이 갈 곳. 분석이 없으면 null */
export function sourceLink(company: CurrentCompany): string | null {
  return company.analysisId === null ? null : `/analyses/${company.analysisId}?tab=source`
}

/**
 * 지금 주소가 '지금 보는 기업'의 화면인지. 아니면(진행 화면에서 아직 기록 전, 다른 기업 화면을 여는 중 등)
 * 묶음의 메뉴를 지금 화면으로 표시하지 않는다
 */
export function isCurrentRoute(company: CurrentCompany, route: { corpCode?: string; analysisId?: string }): boolean {
  if (route.corpCode !== undefined) return route.corpCode === company.corpCode
  if (route.analysisId !== undefined) return route.analysisId === String(company.analysisId)
  return false
}

/** 저장된 글을 읽는다. 모양이 맞지 않으면(옛 값·손댄 값) 없는 것으로 본다 */
export function parseCurrentCompany(raw: string | null): CurrentCompany | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const v = value as Record<string, unknown>
    if (typeof v.corpCode !== 'string' || typeof v.corpName !== 'string') return null
    const stockCode = typeof v.stockCode === 'string' ? v.stockCode : null
    const analysisId = typeof v.analysisId === 'number' && Number.isInteger(v.analysisId) ? v.analysisId : null
    const view = v.view === 'analysis' && analysisId !== null ? 'analysis' : 'company'
    return { corpCode: v.corpCode, corpName: v.corpName, stockCode, analysisId, view }
  } catch {
    return null
  }
}

/** 저장소가 없거나 읽다가 예외가 나면 null */
export function loadCurrentCompany(storage: CurrentCompanyStorage | null): CurrentCompany | null {
  if (storage === null) return null
  try {
    return parseCurrentCompany(storage.getItem(CURRENT_COMPANY_KEY))
  } catch {
    return null
  }
}

/** 저장했으면 true, 저장소가 없거나 실패하면 false */
export function saveCurrentCompany(storage: CurrentCompanyStorage | null, company: CurrentCompany): boolean {
  if (storage === null) return false
  try {
    storage.setItem(CURRENT_COMPANY_KEY, JSON.stringify(company))
    return true
  } catch {
    return false
  }
}
