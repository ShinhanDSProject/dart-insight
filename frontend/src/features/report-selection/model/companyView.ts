import type { ParamChanges } from '@/shared/lib/searchParams'

/**
 * 기업 화면의 맨 위 탭(FS-45, 주소 ?view=, ST-6).
 * - overview: 기업 개요(개황·재무 흐름·주주·공시·AI 브리핑)
 * - compare: 보고서 비교(W-01 ②). 기본값이라 ?view가 없던 기존 주소는 그대로 보고서 비교를 연다
 */
export type CompanyView = 'overview' | 'compare'

export const DEFAULT_COMPANY_VIEW: CompanyView = 'compare'

const views: readonly CompanyView[] = ['overview', 'compare']

/** 주소 값을 읽는다. 없거나 모르는 값이면 보고서 비교다 */
export function parseCompanyView(params: URLSearchParams): CompanyView {
  const view = params.get('view')
  return views.find((v) => v === view) ?? DEFAULT_COMPANY_VIEW
}

/**
 * 탭을 바꿀 때 주소에 적을 값. 기본값(보고서 비교)은 ?view를 지워 기존 주소 모양을 지킨다.
 * 보고서 비교에서 고른 값(?current=&basis=&previous=)은 남겨 두어 탭을 오가도 선택이 그대로다.
 */
export function companyViewChanges(view: CompanyView): ParamChanges {
  return { view: view === DEFAULT_COMPANY_VIEW ? null : view }
}
