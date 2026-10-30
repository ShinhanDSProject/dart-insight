import { match } from 'ts-pattern'
import type {
  CheckpointFact,
  CheckpointFactReason,
  CheckpointItem,
  CheckpointStatus,
  CompanyCheckpoints,
} from '@/shared/api/checkpoints'
import type { BadgeTone } from '@/shared/ui'
import { formatCompactAmount } from '@/shared/lib/chartScale'
import { formatInteger } from '@/shared/lib/numberFormat'

/** 영역 맨 위 안내(FS-62). 서비스는 판정하지 않는다 */
export const CHECKPOINT_NOTICE = '투자자들이 흔히 확인하는 항목을 규칙으로 계산한 것이에요. 좋고 나쁨을 판단하지 않아요.'

export const CHECKPOINT_ERROR_MESSAGES: Record<string, string> = {
  COMPANY_NOT_FOUND: '없는 기업이에요. 검색에서 다시 골라 주세요.',
  DART_REQUEST_FAILED: 'OpenDART에서 보고서 목록을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  DART_RATE_LIMITED: 'OpenDART 호출 한도를 넘었어요. 내일 다시 시도해 주세요.',
}

/** 상태 배지 색. '확인해 볼 점'만 주의 색, 나머지는 중립(빨강·초록을 쓰지 않음) */
export function checkpointTone(status: CheckpointStatus): BadgeTone {
  return match(status)
    .with('CHECK', () => 'attention' as const)
    .with('OK', 'NO_DATA', () => 'neutral' as const)
    .exhaustive()
}

/** 값이 없을 때 그 이유. '0'으로 보이지 않게 한다 */
export function reasonText(reason: CheckpointFactReason | null): string {
  return match(reason)
    .with('MISSING', null, () => '자료 없음')
    .with('PREVIOUS_ZERO', () => '계산 안 함(작년 값 0)')
    .with('PREVIOUS_NEGATIVE', () => '계산 안 함(작년 값 음수)')
    .with('EQUITY_NOT_POSITIVE', () => '계산 안 함(자본총계 0 이하)')
    .with('NOT_CHECKED', () => '확인하지 못함')
    .exhaustive()
}

const decimalFormat = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function signed(value: number): string {
  const text = decimalFormat.format(Math.abs(value))
  return value > 0 ? `+${text}` : value < 0 ? `−${text}` : text
}

/**
 * 수치 한 칸의 글. 금액은 짧게(예: 305.4조원), 증가율·차이는 부호를 붙인다(+10.0%, −4.2%p). 부채비율 같은 비율은
 * 부호 없이(240.0%). 값이 없으면 이유를 쓴다.
 */
export function formatFactValue(fact: CheckpointFact): string {
  if (fact.value === null) return reasonText(fact.reason)
  const value = fact.value
  return match(fact.unit)
    .with('AMOUNT', () => {
      const text = formatCompactAmount(value, fact.currency)
      return fact.currency === null || fact.currency === 'KRW' ? `${text}원` : text
    })
    .with('PERCENT', () => (isGrowth(fact) ? `${signed(value)}%` : `${decimalFormat.format(value)}%`))
    .with('PERCENT_POINT', () => `${signed(value)}%p`)
    .with('COUNT', () => `${formatInteger(value)}건`)
    .with('PRESENCE', () => (value > 0 ? '있음' : '없음'))
    .exhaustive()
}

/** 증가율이면 부호를 붙인다(이름이 '증가율'로 끝남). 부채비율처럼 수준을 나타내는 비율은 붙이지 않는다 */
function isGrowth(fact: CheckpointFact): boolean {
  return fact.label.endsWith('증가율')
}

/** 금액을 원 단위 그대로(예: 1,234,567원). 근거 확인용 */
export function exactAmount(fact: CheckpointFact): string | null {
  if (fact.unit !== 'AMOUNT' || fact.value === null) return null
  const unit = fact.currency === null || fact.currency === 'KRW' ? '원' : ` ${fact.currency}`
  return `${fact.value < 0 ? '−' : ''}${formatInteger(Math.abs(fact.value))}${unit}`
}

export interface CheckpointCounts {
  check: number
  ok: number
  noData: number
}

export function checkpointCounts(items: CheckpointItem[]): CheckpointCounts {
  return {
    check: items.filter((item) => item.status === 'CHECK').length,
    ok: items.filter((item) => item.status === 'OK').length,
    noData: items.filter((item) => item.status === 'NO_DATA').length,
  }
}

/** 재무제표를 받지 못했거나 자료가 없을 때 위쪽 안내. 문제없으면 null */
export function statementNotice(result: CompanyCheckpoints): string | null {
  return match(result.statementStatus)
    .with('FETCH_FAILED', () => '재무제표를 OpenDART에서 받지 못해 일부 항목이 자료 없음이에요. 잠시 뒤 다시 시도해 주세요.')
    .with('NOT_AVAILABLE', () => '두 사업보고서 중 재무제표 자료가 없는 보고서가 있어 일부 항목이 자료 없음이에요.')
    .with('AVAILABLE', null, () => null)
    .exhaustive()
}

/** 재무제표 기준 이름 */
export function checkpointFsDivLabel(fsDiv: CompanyCheckpoints['fsDiv']): string | null {
  return match(fsDiv)
    .with('CFS', () => '연결재무제표')
    .with('OFS', () => '별도재무제표')
    .with(null, () => null)
    .exhaustive()
}
