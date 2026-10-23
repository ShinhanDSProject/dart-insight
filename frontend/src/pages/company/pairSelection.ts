import type { ComparisonBasis, ReportItem } from '@/shared/api/reports'
import { formatDate } from './reportLabels'

/** 기본 비교 기준. 결정 로그 '기본 비교 기준'이 정해지기 전까지 전년 동기(잠정안). */
export const DEFAULT_BASIS: ComparisonBasis = 'YOY'

export const basisOptions: { value: ComparisonBasis; label: string }[] = [
  { value: 'YOY', label: '전년 동기' },
  { value: 'PREV', label: '직전 기간' },
  { value: 'CUSTOM', label: '직접 선택' },
]

export function parseBasis(value: string | null): ComparisonBasis {
  return value === 'YOY' || value === 'PREV' || value === 'CUSTOM' ? value : DEFAULT_BASIS
}

export function basisLabel(basis: ComparisonBasis): string {
  return basisOptions.find((o) => o.value === basis)?.label ?? basis
}

/** 직접 선택할 수 있는 이전 보고서: 현재 보고서보다 대상 기간이 앞선 보고서 */
export function customCandidates(items: ReportItem[], current: ReportItem | null): ReportItem[] {
  if (current === null) return []
  return items.filter((r) => r.rceptNo !== current.rceptNo && r.periodEnd < current.periodEnd)
}

/** 고르는 목록에 보이는 문구. 같은 이름의 보고서를 제출일로 구분한다. */
export function reportOptionLabel(report: ReportItem): string {
  return `${report.reportName} · 제출 ${formatDate(report.receivedAt)}`
}
