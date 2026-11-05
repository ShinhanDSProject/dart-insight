import type { ReportType } from '@/shared/api/reports'

/** 이번 시즌 변화가 큰 기업(1.7) 화면 문구. 순위는 바뀐 양이지 좋고 나쁨이 아니다 */
const shortNames: Record<ReportType, string> = {
  Q1: '1분기',
  HALF: '반기',
  Q3: '3분기',
  ANNUAL: '사업보고서',
}

/** 2026 반기 */
export function seasonName(reportType: ReportType, fiscalYear: number): string {
  return `${fiscalYear} ${shortNames[reportType]}`
}

/** 2026 반기 vs 2025 반기 · 대표 기업 100곳 대상 */
export function seasonCaption(reportType: ReportType, fiscalYear: number, previousFiscalYear: number, candidates: number): string {
  return `${seasonName(reportType, fiscalYear)} vs ${seasonName(reportType, previousFiscalYear)} · 대표 기업 ${candidates}곳 대상`
}
