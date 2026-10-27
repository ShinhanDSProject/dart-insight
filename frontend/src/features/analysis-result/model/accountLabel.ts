/**
 * 재무 계정의 화면 이름(#401). 자본변동표는 같은 계정명(예: 기초자본)이 자본 구성요소마다 여러 줄이라,
 * 계정 상세(OpenDART account_detail)의 마지막 구성요소 이름을 덧붙여 구분한다.
 */
import type { FinancialChangeItem } from '@/shared/api/results'

/** 구성요소 이름 뒤의 '[구성요소]'·'[member]'·'[도메인]' 같은 꼬리표 */
const TAG = /\s*\[[^\]]*\]\s*$/

/** '자본 [구성요소]|지배기업의 소유주에게 귀속되는 지분 [구성요소]|이익잉여금 [구성요소]' → '이익잉여금' */
export function componentName(detail: string | null): string | null {
  if (detail === null) return null
  const last = detail.split('|').at(-1)?.replace(TAG, '').trim() ?? ''
  return last.length > 0 ? last : null
}

/** 화면에 보일 계정 이름. 구성요소가 있으면 '기초자본 · 이익잉여금' */
export function accountLabel(item: Pick<FinancialChangeItem, 'accountName' | 'accountDetail'>): string {
  const component = componentName(item.accountDetail)
  return component === null ? item.accountName : `${item.accountName} · ${component}`
}
