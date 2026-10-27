import { match } from 'ts-pattern'
import type { FinancialTrend, KeyAccountKey, TrendPeriod } from '@/shared/api/financialTrends'

/**
 * 주요계정 금액으로 계산하는 재무 비율(FS-54). 응답에 없는 숫자는 만들지 않고, 받은 두 금액을 나누기만 한다.
 * 없는 값(null)은 0으로 보지 않고 계산하지 않는다. 손익은 그 보고서의 금액 기준(누적·3개월) 그대로 쓰고 연환산하지 않는다.
 * 업종·기준값과 비교하거나 좋음·나쁨을 정하지 않는다. 여러 화면(기업 개요, 여러 기업 비교)이 같이 쓴다.
 */

export type RatioKey = 'DEBT_RATIO' | 'CURRENT_RATIO' | 'OPERATING_MARGIN' | 'NET_MARGIN'

/** 계산하지 못한 이유. 분모를 먼저 본다 */
export type RatioReason = 'DENOMINATOR_MISSING' | 'DENOMINATOR_ZERO' | 'DENOMINATOR_NEGATIVE' | 'NUMERATOR_MISSING'

/** 손익 금액 기준. 누적: 사업연도 시작부터, 3개월: 그 분기 석 달 */
export type RatioIncomeBasis = 'CUMULATIVE' | 'QUARTER'

export interface RatioDefinition {
  key: RatioKey
  name: string
  numerator: KeyAccountKey
  denominator: KeyAccountKey
  numeratorName: string
  denominatorName: string
  /** 예: 부채총계 ÷ 자본총계 × 100 */
  formula: string
}

function definition(
  key: RatioKey,
  name: string,
  numerator: KeyAccountKey,
  numeratorName: string,
  denominator: KeyAccountKey,
  denominatorName: string,
): RatioDefinition {
  return {
    key,
    name,
    numerator,
    denominator,
    numeratorName,
    denominatorName,
    formula: `${numeratorName} ÷ ${denominatorName} × 100`,
  }
}

/** 보여 주는 순서: 재무상태표 비율 → 손익 비율 */
export const RATIO_DEFINITIONS: readonly RatioDefinition[] = [
  definition('DEBT_RATIO', '부채비율', 'TOTAL_LIABILITIES', '부채총계', 'TOTAL_EQUITY', '자본총계'),
  definition('CURRENT_RATIO', '유동비율', 'CURRENT_ASSETS', '유동자산', 'CURRENT_LIABILITIES', '유동부채'),
  definition('OPERATING_MARGIN', '영업이익률', 'OPERATING_INCOME', '영업이익', 'REVENUE', '매출액'),
  definition('NET_MARGIN', '순이익률', 'NET_INCOME', '당기순이익', 'REVENUE', '매출액'),
]

/** 손익 금액이 들어가는 비율인지(손익 금액 기준 누적·3개월을 함께 적는다) */
export function isIncomeRatio(key: RatioKey): boolean {
  return match(key)
    .with('DEBT_RATIO', 'CURRENT_RATIO', () => false)
    .with('OPERATING_MARGIN', 'NET_MARGIN', () => true)
    .exhaustive()
}

/** 비율 계산에 넣는 금액 하나. amount가 null이면 값 없음(0과 다름) */
export interface RatioAmount {
  amount: number | null
  currency: string | null
}

export interface RatioResult {
  key: RatioKey
  name: string
  formula: string
  numeratorName: string
  denominatorName: string
  numerator: number | null
  denominator: number | null
  currency: string | null
  /** 백분율(%) 값. 반올림하지 않은 값이다. 계산하지 못하면 null */
  value: number | null
  /** 계산하지 못한 이유. 계산했으면 null */
  reason: RatioReason | null
  /** 두 금액의 근거 공시 접수번호(겹치지 않게) */
  sourceRceptNos: string[]
}

function reasonOf(numerator: number | null, denominator: number | null): RatioReason | null {
  if (denominator === null) return 'DENOMINATOR_MISSING'
  if (denominator === 0) return 'DENOMINATOR_ZERO'
  if (denominator < 0) return 'DENOMINATOR_NEGATIVE'
  if (numerator === null) return 'NUMERATOR_MISSING'
  return null
}

/** 두 금액으로 비율 하나를 계산한다. 계산하지 못하면 value가 null이고 reason에 이유가 있다 */
export function computeRatio(
  def: RatioDefinition,
  numerator: RatioAmount,
  denominator: RatioAmount,
  sourceRceptNos: readonly string[],
): RatioResult {
  const reason = reasonOf(numerator.amount, denominator.amount)
  const value = reason === null ? ((numerator.amount as number) / (denominator.amount as number)) * 100 : null
  return {
    key: def.key,
    name: def.name,
    formula: def.formula,
    numeratorName: def.numeratorName,
    denominatorName: def.denominatorName,
    numerator: numerator.amount,
    denominator: denominator.amount,
    currency: denominator.currency ?? numerator.currency,
    value,
    reason,
    sourceRceptNos: [...new Set(sourceRceptNos)],
  }
}

/** 사업보고서는 4분기 3개월 값이 없어 늘 누적(1년)이다 */
function incomeBasisFor(type: TrendPeriod['reportType'], basis: RatioIncomeBasis): RatioIncomeBasis {
  return type === 'ANNUAL' ? 'CUMULATIVE' : basis
}

/** 값의 근거 공시: 정정 공시 값이면 그 접수번호, 아니면 보고서 접수번호 */
export function periodSourceRceptNo(period: Pick<TrendPeriod, 'rceptNo' | 'sourceRceptNo'>): string {
  return period.sourceRceptNo ?? period.rceptNo
}

/**
 * 주요 재무 흐름 응답의 한 기간(periods의 index)에서 네 비율을 계산한다.
 * 재무상태표는 기말 잔액, 손익은 basis(누적·3개월)의 금액을 쓴다. 사업보고서는 늘 누적이다.
 */
export function periodRatios(trend: FinancialTrend, index: number, basis: RatioIncomeBasis): RatioResult[] {
  const period = trend.periods[index]
  const income = period === undefined ? basis : incomeBasisFor(period.reportType, basis)
  const amountOf = (key: KeyAccountKey): RatioAmount => {
    const account = trend.accounts.find((a) => a.key === key)
    const value = account?.values[index]
    if (account === undefined || value === undefined) return { amount: null, currency: null }
    const amount = account.sjDiv === 'IS' && income === 'QUARTER' ? value.quarterAmount : value.amount
    return { amount: amount ?? null, currency: value.currency }
  }
  const sources = period === undefined ? [] : [periodSourceRceptNo(period)]
  return RATIO_DEFINITIONS.map((def) => computeRatio(def, amountOf(def.numerator), amountOf(def.denominator), sources))
}

/** 받침이 있으면 '이', 없으면 '가'를 붙인다(예: 매출액이, 자본총계가) */
function withSubject(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00
  const hasFinal = code >= 0 && code <= 11171 && code % 28 !== 0
  return `${word}${hasFinal ? '이' : '가'}`
}

/** 계산하지 못한 이유의 짧은 문구. 예: '계산 불가 · 매출액 미기재' */
export function ratioReasonLabel(result: Pick<RatioResult, 'reason' | 'numeratorName' | 'denominatorName'>): string | null {
  return match(result.reason)
    .with(null, () => null)
    .with('DENOMINATOR_MISSING', () => `계산 불가 · ${result.denominatorName} 미기재`)
    .with('DENOMINATOR_ZERO', () => `계산 불가 · ${withSubject(result.denominatorName)} 0`)
    .with('DENOMINATOR_NEGATIVE', () => `계산 불가 · ${withSubject(result.denominatorName)} 음수`)
    .with('NUMERATOR_MISSING', () => `계산 불가 · ${result.numeratorName} 미기재`)
    .exhaustive()
}

const ratioFormat = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** 비율 표시(소수 첫째 자리, 화면에서만 반올림). 예: 25.4%, −3.2%, 1,234.5%. 계산하지 못하면 null */
export function formatRatio(value: number | null): string | null {
  if (value === null) return null
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return '0.0%'
  const sign = rounded < 0 ? '−' : ''
  return `${sign}${ratioFormat.format(Math.abs(rounded))}%`
}
