import type { ReportType } from '@/shared/api/reports'
import type { SeasonKey } from '@/shared/api/seasonChanges'
import { reportTypeLabel } from '@/shared/lib/reportLabels'

/** 이번 시즌 변화가 큰 기업(1.7) 화면 문구. 순위는 바뀐 양이지 좋고 나쁨이 아니다 */
export const SEASON_SCORE_NOTE =
  '줄을 누르면 그 비교의 분석 결과로 가요. 점수는 코드가 계산해요(숫자만 바뀜·위치 이동 제외, 섹션 가중치, 문서 길이 보정). 바뀐 양이지 좋고 나쁨이 아니에요.'

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

/** 고르기 항목: 2026 반기보고서 */
export function seasonOptionLabel(season: SeasonKey): string {
  return `${season.fiscalYear} ${reportTypeLabel(season.reportType)}`
}

/** 고르기 값 HALF-2026 ↔ 시즌 */
export function seasonValue(season: SeasonKey): string {
  return `${season.reportType}-${season.fiscalYear}`
}

export function parseSeasonValue(value: string, seasons: SeasonKey[]): SeasonKey | null {
  return seasons.find((season) => seasonValue(season) === value) ?? null
}

/** 2026 반기 vs 2025 반기 · 대표 기업 100곳 대상 */
export function seasonCaption(reportType: ReportType, fiscalYear: number, previousFiscalYear: number, candidates: number): string {
  return `${seasonName(reportType, fiscalYear)} vs ${seasonName(reportType, previousFiscalYear)} · 대표 기업 ${candidates}곳 대상`
}

/** 순위에서 빠진 기업 안내. 빠진 곳이 없으면 null */
export function excludedNote(excluded: { noReport: number; failed: number }): string | null {
  const parts = [
    excluded.noReport > 0 ? `보고서가 아직 없는 ${excluded.noReport}곳` : null,
    excluded.failed > 0 ? `원문을 비교하지 못한 ${excluded.failed}곳` : null,
  ].filter((part): part is string => part !== null)
  return parts.length === 0 ? null : `${parts.join(', ')}은 순위에서 뺐어요.`
}
