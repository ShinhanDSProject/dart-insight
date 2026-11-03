import { match } from 'ts-pattern'
import type { BadgeTone } from '@/shared/ui'
import type {
  AmountBasis,
  CheckStatus,
  ComparabilityCheck,
  ComparabilityReason,
  ComparabilityResult,
  StatementComparability,
} from '@/shared/api/comparability'

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

const statusTones: Record<CheckStatus, BadgeTone> = {
  OK: 'neutral',
  WARN: 'attention',
  FAIL: 'danger',
  SKIPPED: 'neutral',
}

/** 비교 조건 표 오른쪽 배지 색(#549). 문제 행만 노랑(주의)·분홍(비교 불가)으로 눈에 띈다 */
export function checkStatusTone(status: CheckStatus): BadgeTone {
  return statusTones[status] ?? 'neutral'
}

export interface CheckHeader {
  title: string
  badge: { tone: BadgeTone; label: string } | null
}

const NOT_COMPARABLE_TITLE = '이 두 보고서는 비교할 수 없어요'

/** 비교 불가 사유(reasons[].code, docs/api-spec.md)별 화면 제목(FS-68 AC4). 모르는 사유면 null */
export function reasonTitle(code: string): string | null {
  return match(code)
    .with('DIFFERENT_COMPANY', () => '같은 기업의 보고서를 골라 주세요')
    .with('SAME_REPORT', () => '서로 다른 보고서를 선택해 주세요')
    .with('PREVIOUS_NOT_EARLIER', () => '비교 보고서는 더 앞선 기간이어야 해요')
    .with('REPLACED_BY_CORRECTION', () => '정정 공시로 대체된 보고서가 있어요')
    .with('NO_FINANCIAL_DATA', () => '재무제표가 없는 보고서가 있어요')
    .with('DATA_VERSION_MISMATCH', () => '재무 자료가 정정본 기준이에요')
    .with('NO_COMMON_BASIS', () => '같은 기준의 재무제표가 없어요')
    .with('CURRENCY_MISMATCH', () => '두 보고서의 통화가 달라요')
    .otherwise(() => null)
}

/**
 * 비교 확인 화면 머리(#549). 비교할 수 있으면 '분석 준비'(보라), 없으면 '비교 불가'(분홍) 배지와 제목을 바꾼다.
 * 비교 불가면 첫 사유에 맞춘 제목을 쓰고, 모르는 사유거나 사유가 없으면 일반 제목을 쓴다(FS-68 AC4).
 * 결과가 아직 없으면(불러오는 중·오류) 기본 제목만 둔다.
 */
export function checkHeader(result: Pick<ComparabilityResult, 'comparable' | 'reasons'> | null): CheckHeader {
  if (result === null) return { title: '비교 대상을 확인하세요', badge: null }
  if (result.comparable) return { title: '비교 대상을 확인하세요', badge: { tone: 'accent', label: '분석 준비' } }
  const first = result.reasons[0]
  const title = (first && reasonTitle(first.code)) ?? NOT_COMPARABLE_TITLE
  return { title, badge: { tone: 'danger', label: '비교 불가' } }
}

/**
 * 사유가 어느 조건 행(checks[].item)을 실패시키는지와 그 행의 짧은 배지 글.
 * backend ComparabilityService에서 사유와 FAIL 행이 함께 정해지는 짝만 둔다. 자료가 없어서 생기는 사유는
 * '자료 준비 상태'(DATA_READY)에 붙는다('수치 기준'도 함께 실패하지만 그 행은 사유를 하나로 정할 수 없어 일반 배지로 둔다).
 */
function reasonBadge(code: string): { item: string; label: string } | null {
  return match(code)
    .with('DIFFERENT_COMPANY', () => ({ item: 'COMPANY', label: '다른 기업' }))
    .with('SAME_REPORT', () => ({ item: 'REPORT_PERIOD', label: '동일 보고서' }))
    .with('PREVIOUS_NOT_EARLIER', () => ({ item: 'REPORT_PERIOD', label: '기간 순서' }))
    .with('REPLACED_BY_CORRECTION', () => ({ item: 'CORRECTION', label: '정정으로 대체' }))
    .with('CURRENCY_MISMATCH', () => ({ item: 'FINANCIAL_BASIS', label: '통화 다름' }))
    .with('NO_FINANCIAL_DATA', () => ({ item: 'DATA_READY', label: '재무제표 없음' }))
    .with('DATA_VERSION_MISMATCH', () => ({ item: 'DATA_READY', label: '정정본 자료' }))
    .with('NO_COMMON_BASIS', () => ({ item: 'DATA_READY', label: '공통 기준 없음' }))
    .otherwise(() => null)
}

/**
 * 조건 표 오른쪽 배지 글(FS-68 AC4). FAIL 행은 그 행에 붙는 사유가 한 가지로 정해지면 짧은 사유('동일 보고서' 등)를,
 * 정해지지 않으면(사유를 모르거나 서로 다른 사유가 둘 이상) 일반 '비교 불가'를 쓴다. 그 밖의 상태는 상태 글 그대로다.
 */
export function checkBadgeLabel(check: Pick<ComparabilityCheck, 'item' | 'status'>, reasons: ComparabilityReason[]): string {
  if (check.status !== 'FAIL') return checkStatusLabel(check.status)
  const labels = new Set<string>()
  for (const reason of reasons) {
    const badge = reasonBadge(reason.code)
    if (badge?.item === check.item) labels.add(badge.label)
  }
  const [only] = [...labels]
  return labels.size === 1 && only !== undefined ? only : checkStatusLabel(check.status)
}
