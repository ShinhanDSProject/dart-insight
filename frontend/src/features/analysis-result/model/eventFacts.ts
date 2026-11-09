import type { TextEventFact } from '@/shared/api/textEvents'
import { DEFAULT_UNIT, formatAmount, formatChange, formatRate, missingValueLabel, shortCalcLabel, unitLabel, type AmountUnit } from './format'

/** 사건 카드의 사실 칸(3.43, AC28) 화면 문구 */
export const FACTS_TITLE = '관련 재무 숫자'
export const FACTS_NOTE = '재무 수치 탭과 같은 값이에요. 이 사건이 숫자를 바꾼 원인이라는 뜻은 아니에요.'

/** 재무 수치 탭의 기본 단위로 보인다 */
const FACT_UNIT: AmountUnit = DEFAULT_UNIT

export interface FactRow {
  changeId: number
  /** 투자 유형이 있으면 '시설 투자 · 건설중인자산' */
  account: string
  previous: string
  current: string
  /** 증감액. 계산하지 않았으면 사유 */
  change: string
  /** 증감률. 계산하지 않았으면 사유, 사유도 없으면 '—' */
  rate: string
}

export interface FactsView {
  rows: FactRow[]
  /** 표 단위. 예: 백만원 */
  unit: string
}

const NO_RATE = '—'

/**
 * 사실 칸에 보일 것. 값은 backend가 재무 수치 탭의 항목을 그대로 준 것이라 다시 계산하지 않고 재무 수치 탭과 같은 함수로 적는다.
 * 이전·이번 값이 모두 없는 계정은 빼고, 남는 계정이 없으면 null(칸 없음)
 */
export function factsView(facts: TextEventFact[]): FactsView | null {
  const shown = facts.filter((fact) => fact.previousAmount !== null || fact.currentAmount !== null)
  if (shown.length === 0) return null
  return { rows: shown.map(factRow), unit: unitLabel(FACT_UNIT, shown[0].currency) }
}

function factRow(fact: TextEventFact): FactRow {
  const reason = shortCalcLabel(fact.calcStatus)
  return {
    changeId: fact.changeId,
    account: fact.accountType === null ? fact.accountName : `${fact.accountType} · ${fact.accountName}`,
    previous: formatAmount(fact.previousAmount, FACT_UNIT) ?? missingValueLabel(fact.calcStatus, 'previous'),
    current: formatAmount(fact.currentAmount, FACT_UNIT) ?? missingValueLabel(fact.calcStatus, 'current'),
    change: formatChange(fact.changeAmount, FACT_UNIT) ?? reason ?? NO_RATE,
    rate: formatRate(fact.changeRate) ?? reason ?? NO_RATE,
  }
}
