import type { TextChangeCounts } from '@/shared/api/textChanges'
import { formatCount } from './textFilter'

/**
 * 위험 요인 변화(3.9, FS-61). 위험 관련은 서버가 목차 제목 낱말로 정한다(docs/api-spec.md text-changes의 riskRelated).
 * 건수만 보여 주고 위험의 크기나 좋고 나쁨은 말하지 않는다.
 */

export const RISK_TITLE = '위험 요인 변화'
export const RISK_FILTER_LABEL = '위험 관련만'
export const RISK_BADGE = '위험 관련'
export const RISK_EMPTY = '위험 관련 목차에서 바뀐 문장이 없어요.'
export const RISK_NOTE = '목차 제목으로 나눈 것이라 실제 내용과 다를 수 있어요.'
export const RISK_SCOPE = '위험관리·파생거래, 예측정보, 우발부채·소송, 제재 목차의 문장 변화예요.'
export const RISK_FILTERED_SCOPE = '고른 섹션·검색어 안에서 센 건수예요.'

export interface RiskStat {
  key: 'added' | 'deleted' | 'modified'
  label: string
  value: number
}

/** 카드의 세 건수(새로 생긴·사라진·바뀐). 응답 건수를 그대로 쓴다 */
export function riskStats(counts: TextChangeCounts): RiskStat[] {
  return [
    { key: 'added', label: '새로 생긴 문장', value: counts.added },
    { key: 'deleted', label: '사라진 문장', value: counts.deleted },
    { key: 'modified', label: '바뀐 문장', value: counts.modified },
  ]
}

/** 위험 관련 변경이 하나라도 있는지(유형 무관) */
export function hasRiskChanges(counts: TextChangeCounts): boolean {
  return counts.all > 0
}

/** 카드 본문 상태. loading: 건수를 아직 모름, empty: 위험 관련 변경 없음 */
export type RiskCardView = { kind: 'loading' } | { kind: 'empty' } | { kind: 'counts'; counts: TextChangeCounts }

export function riskCardView(counts: TextChangeCounts | null): RiskCardView {
  if (counts === null) return { kind: 'loading' }
  return hasRiskChanges(counts) ? { kind: 'counts', counts } : { kind: 'empty' }
}

/** 세 건수에 들지 않는 위험 관련 변경(숫자만 바뀜·위치 이동·검토 필요) 안내. 없으면 null */
export function otherRiskLabel(counts: TextChangeCounts): string | null {
  const others = counts.numericUpdate + counts.moved + counts.reviewNeeded
  return others > 0 ? `그 밖에 숫자만 바뀜·위치 이동·검토 필요 ${formatCount(others)}건이 있어요.` : null
}
