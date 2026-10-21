import type { Correction, FinancialDataStatus, ReportItem, ReportType } from '../../api/reports'

/** 화면에 보이는 보고서 정보 문구. 대상 기간과 제출일을 서로 다른 모양으로 보여 준다. */

const periodNames: Record<ReportType, string> = {
  Q1: '1분기',
  HALF: '반기',
  Q3: '3분기',
  ANNUAL: '사업연도',
}

const correctionLabels: Record<Correction, string> = {
  ORIGINAL: '정정 없음',
  CORRECTED: '정정 있음 · 최종본',
  UNKNOWN: '확인 안 됨',
}

const dataStatusLabels: Record<FinancialDataStatus, string> = {
  UNKNOWN: '확인 전',
  AVAILABLE: '준비됨',
  NOT_AVAILABLE: '재무 자료 없음',
}

/** 2026-08-14 → 2026.08.14 */
export function formatDate(isoDate: string): string {
  return isoDate.replaceAll('-', '.')
}

/**
 * 대상 기간. 12월 결산 보고서만 다루므로 사업연도는 1월 1일에 시작한다.
 * 예: 반기보고서 → "2026 반기 (2026.01.01 ~ 2026.06.30)"
 */
export function periodLabel(report: Pick<ReportItem, 'reportType' | 'fiscalYear' | 'periodEnd'>): string {
  const start = `${report.fiscalYear}.01.01`
  return `${report.fiscalYear} ${periodNames[report.reportType]} (${start} ~ ${formatDate(report.periodEnd)})`
}

export function correctionLabel(correction: Correction): string {
  return correctionLabels[correction] ?? correctionLabels.UNKNOWN
}

export function dataStatusLabel(status: FinancialDataStatus): string {
  return dataStatusLabels[status] ?? dataStatusLabels.UNKNOWN
}

export const dataStatusHelp: Record<FinancialDataStatus, string> = {
  UNKNOWN: '분석을 요청할 때 OpenDART에서 재무제표를 받아 확인해요.',
  AVAILABLE: '재무제표를 받아 두었어요.',
  NOT_AVAILABLE: 'OpenDART 재무제표 API가 제공하지 않는 보고서예요(2015 사업연도 이전 등).',
}
