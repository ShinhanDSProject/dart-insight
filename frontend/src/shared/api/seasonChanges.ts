import { apiGet } from './client'
import { endpoints } from './endpoints'
import type { ReportType } from './reports'

/** docs/api-spec.md GET /api/season-changes (1.7, #420). 시즌은 정기보고서 종류·사업연도 */
export interface SeasonKey {
  reportType: ReportType
  fiscalYear: number
}

export interface SeasonChangeItem {
  rank: number
  corpCode: string
  corpName: string | null
  stockCode: string | null
  previousRceptNo: string | null
  currentRceptNo: string | null
  /** 점수에 넣은 문장 변경(추가·삭제·수정) 건수 */
  changeCount: number | null
  /** 코드가 만든 한 줄 요약 */
  highlight: string | null
  /** 요약까지 있는 전년 동기 분석. 요청하지 못했으면 null */
  analysisId: number | null
}

export interface SeasonChangeList {
  /** 계산한 시즌이 하나도 없으면 null */
  season: (SeasonKey & { previousFiscalYear: number }) | null
  /** 계산한 시즌, 최근 순 */
  seasons: SeasonKey[]
  computedAt: string | null
  scoreVersion: string
  candidateCount: number
  rankedCount: number
  excluded: { noReport: number; failed: number }
  items: SeasonChangeItem[]
}

export function getSeasonChanges(season: SeasonKey | null, signal?: AbortSignal): Promise<SeasonChangeList> {
  const query = season === null ? undefined : { reportType: season.reportType, fiscalYear: season.fiscalYear }
  return apiGet(endpoints.seasonChanges(), query, { signal })
}
