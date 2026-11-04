/**
 * 상단 '최근 본 기업' 줄(#502, #652). 최근에 연 기업과 기업마다 마지막으로 연 분석을 브라우저(localStorage)에 남겨, 홈에 나갔다가도
 * 기업 이름으로 그 분석 결과에 돌아가게 한다(#572). 서버에는 보내지 않고, 저장을 쓸 수 없으면 이번 방문 동안만 기억한다.
 */
export const CURRENT_COMPANY_KEY = 'dart-insight:current-company'
/** 줄에 두는 기업 수(#652). 상단 줄이 좁아 몇 개만 둔다 */
export const RECENT_COMPANY_LIMIT = 3
/** 같은 탭 안에서 바뀐 것을 알리는 이벤트 이름(다른 탭은 storage 이벤트로 안다) */
export const CURRENT_COMPANY_CHANGE_EVENT = 'dart-insight:current-company-change'

export type CurrentCompanyStorage = Pick<Storage, 'getItem' | 'setItem'>

export interface CurrentCompany {
  corpCode: string
  corpName: string
  stockCode: string | null
  /** 이 기업에서 마지막으로 연 분석. 없으면 null(기업 이름이 기업 화면으로 감) */
  analysisId: number | null
  /** 마지막으로 본 화면(기업 화면·분석 결과) */
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
 * 새로 연 화면으로 기업 항목을 만든다. 같은 기업의 전 항목이 있으면 모르는 값(종목코드·분석)은 전에 알던 것을 이어 쓰고,
 * 다른 기업(또는 처음 연 기업)이면 전 항목의 분석을 쓰지 않는다.
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

/** 기업 이름이 갈 곳(#572): 마지막으로 연 분석이 있으면 그 분석 결과, 없으면 기업 화면 */
export function companyLink(company: CurrentCompany): string {
  return company.analysisId === null
    ? `/companies/${encodeURIComponent(company.corpCode)}`
    : `/analyses/${company.analysisId}`
}

/** 같은 기업을 다시 열면 그 항목을 맨 앞으로 옮긴다(#652). 가장 최근 기업이 맨 앞이고, 넘치면 가장 오래된 기업이 빠진다 */
export function nextRecentCompanies(previous: CurrentCompany[], visit: CompanyVisit): CurrentCompany[] {
  const same = previous.find((company) => company.corpCode === visit.corpCode) ?? null
  const rest = previous.filter((company) => company.corpCode !== visit.corpCode)
  return [nextCurrentCompany(same, visit), ...rest].slice(0, RECENT_COMPANY_LIMIT)
}

/** 저장된 글을 읽는다. 예전 값(기업 하나)도 읽고, 모양이 맞지 않는 항목(옛 값·손댄 값)은 버린다 */
export function parseRecentCompanies(raw: string | null): CurrentCompany[] {
  if (raw === null) return []
  try {
    const value: unknown = JSON.parse(raw)
    const entries = Array.isArray(value) ? value : [value]
    return entries.flatMap((entry) => parseEntry(entry) ?? []).slice(0, RECENT_COMPANY_LIMIT)
  } catch {
    return []
  }
}

function parseEntry(value: unknown): CurrentCompany | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  if (typeof v.corpCode !== 'string' || typeof v.corpName !== 'string') return null
  const stockCode = typeof v.stockCode === 'string' ? v.stockCode : null
  const analysisId = typeof v.analysisId === 'number' && Number.isInteger(v.analysisId) ? v.analysisId : null
  const view = v.view === 'analysis' && analysisId !== null ? 'analysis' : 'company'
  return { corpCode: v.corpCode, corpName: v.corpName, stockCode, analysisId, view }
}

/** 저장소가 없거나 읽다가 예외가 나면 빈 목록 */
export function loadRecentCompanies(storage: CurrentCompanyStorage | null): CurrentCompany[] {
  if (storage === null) return []
  try {
    return parseRecentCompanies(storage.getItem(CURRENT_COMPANY_KEY))
  } catch {
    return []
  }
}

/** 저장했으면 true, 저장소가 없거나 실패하면 false */
export function saveRecentCompanies(storage: CurrentCompanyStorage | null, companies: CurrentCompany[]): boolean {
  if (storage === null) return false
  try {
    storage.setItem(CURRENT_COMPANY_KEY, JSON.stringify(companies))
    return true
  } catch {
    return false
  }
}
