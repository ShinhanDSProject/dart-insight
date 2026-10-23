import type { ReportItem } from '@/shared/api/reports'
import { formatDate } from '@/shared/lib/reportLabels'

/** 직접 선택할 수 있는 이전 보고서: 현재 보고서보다 대상 기간이 앞선 보고서 */
export function customCandidates(items: ReportItem[], current: ReportItem | null): ReportItem[] {
  if (current === null) return []
  return items.filter((r) => r.rceptNo !== current.rceptNo && r.periodEnd < current.periodEnd)
}

/** 고르는 목록에 보이는 문구. 같은 이름의 보고서를 제출일로 구분한다. */
export function reportOptionLabel(report: ReportItem): string {
  return `${report.reportName} · 제출 ${formatDate(report.receivedAt)}`
}
