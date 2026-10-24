import type { CompanyAnalysisItem } from '@/shared/api/analyses'
import { basisLabel } from '@/shared/lib/comparisonBasis'

/** 기업 화면에 보이는 '이미 분석한 비교' 개수 */
export const PAST_ANALYSES_LIMIT = 5

/** 완료 시각의 월/일. '2026-10-24T15:20:31' → '10/24'. 형식이 다르면 빈 문자열 */
export function completedDateLabel(completedAt: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(completedAt)
  return m ? `${m[1]}/${m[2]}` : ''
}

/** 예: '반기보고서 (2025.06) → 반기보고서 (2026.06) · 전년 동기 · 10/24 완료' */
export function pastAnalysisLabel(item: CompanyAnalysisItem): string {
  const date = completedDateLabel(item.completedAt)
  const parts = [`${item.previous.reportName} → ${item.current.reportName}`, basisLabel(item.basis)]
  if (date) parts.push(`${date} 완료`)
  return parts.join(' · ')
}
