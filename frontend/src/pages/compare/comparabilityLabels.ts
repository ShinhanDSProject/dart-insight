import type { AmountBasis, CheckStatus, ComparabilityResult, StatementComparability } from '../../api/comparability'

const statusLabels: Record<CheckStatus, string> = {
  OK: '확인됨',
  WARN: '주의',
  FAIL: '비교 불가',
  SKIPPED: '확인 안 함',
}

const amountBasisLabels: Record<AmountBasis, string> = {
  POINT: '기말 시점 금액',
  CUMULATIVE: '누적 금액',
  QUARTER: '3개월 금액',
}

export function checkStatusLabel(status: CheckStatus): string {
  return statusLabels[status] ?? status
}

export function statementBasisLabel(statement: StatementComparability): string {
  if (!statement.comparable || statement.amountBasis === null) return '비교 안 함'
  return amountBasisLabels[statement.amountBasis]
}

/** 검증 결과 한 줄 요약 */
export function resultSummary(result: Pick<ComparabilityResult, 'comparable' | 'level' | 'fsDiv'>): string {
  if (!result.comparable) return '이 두 보고서는 비교할 수 없어요.'
  const basis = result.fsDiv === 'OFS' ? '별도 재무제표' : '연결 재무제표'
  if (result.level === 'PARTIAL') {
    return `비교할 수 있어요(${basis}). 기간 길이가 달라 일부 재무제표만 비교해요.`
  }
  return `비교할 수 있어요(${basis}). 계산할 수 없는 항목은 결과에 사유를 함께 표시해요.`
}
