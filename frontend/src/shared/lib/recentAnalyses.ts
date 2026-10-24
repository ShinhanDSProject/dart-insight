/**
 * 최근 본 분석(FS-7). 결과 화면이 기록하고 검색 화면이 보여 주므로 shared에 둔다(DIR-4).
 * 브라우저(localStorage)에만 남기고 서버에는 보내지 않는다. 저장을 쓸 수 없으면 조용히 빈 목록으로 지낸다.
 */
import type { Analysis } from '@/shared/api/analyses'
import type { ReportItem } from '@/shared/api/reports'
import { basisLabel } from './comparisonBasis'

export const RECENT_ANALYSES_KEY = 'dart-insight:recent-analyses'
export const RECENT_ANALYSES_LIMIT = 8

export interface RecentAnalysis {
  analysisId: number
  corpName: string
  previousReportName: string
  currentReportName: string
  /** 비교 기준 이름(예: '전년 동기') */
  basisLabel: string
  /** 본 시각(ISO 8601) */
  viewedAt: string
}

/** 결과 화면의 분석에서 기록할 항목을 만든다(개인정보 없이 화면에 보일 이름만) */
export type RecentAnalysisSource = Pick<Analysis, 'analysisId' | 'corpName' | 'basis'> & {
  previous: Pick<ReportItem, 'reportName'>
  current: Pick<ReportItem, 'reportName'>
}

export function toRecentAnalysis(analysis: RecentAnalysisSource, viewedAt: Date): RecentAnalysis {
  return {
    analysisId: analysis.analysisId,
    corpName: analysis.corpName,
    previousReportName: analysis.previous.reportName,
    currentReportName: analysis.current.reportName,
    basisLabel: basisLabel(analysis.basis),
    viewedAt: viewedAt.toISOString(),
  }
}

/** 저장할 수 있는 곳. 테스트에서는 가짜를 넘긴다 */
export type RecentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function isRecentAnalysis(value: unknown): value is RecentAnalysis {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.analysisId === 'number' &&
    Number.isInteger(v.analysisId) &&
    typeof v.corpName === 'string' &&
    typeof v.previousReportName === 'string' &&
    typeof v.currentReportName === 'string' &&
    typeof v.basisLabel === 'string' &&
    typeof v.viewedAt === 'string' &&
    !Number.isNaN(Date.parse(v.viewedAt))
  )
}

/** 저장된 글자를 목록으로 읽는다. 깨진 값이면 빈 목록, 모양이 틀린 항목·중복은 버리고 8개까지만 둔다 */
export function parseRecentAnalyses(raw: string | null): RecentAnalysis[] {
  if (raw === null) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const seen = new Set<number>()
  const list: RecentAnalysis[] = []
  for (const item of parsed) {
    if (!isRecentAnalysis(item) || seen.has(item.analysisId)) continue
    seen.add(item.analysisId)
    list.push(item)
  }
  return list.slice(0, RECENT_ANALYSES_LIMIT)
}

/** 맨 앞에 더한다. 같은 분석이 이미 있으면 빼고 맨 앞으로 옮기고, 8개를 넘으면 오래된 것을 버린다 */
export function addRecentAnalysis(list: RecentAnalysis[], entry: RecentAnalysis): RecentAnalysis[] {
  return [entry, ...list.filter((item) => item.analysisId !== entry.analysisId)].slice(0, RECENT_ANALYSES_LIMIT)
}

export function removeRecentAnalysis(list: RecentAnalysis[], analysisId: number): RecentAnalysis[] {
  return list.filter((item) => item.analysisId !== analysisId)
}

/** 브라우저 저장소. 사생활 보호 모드처럼 접근만으로 예외가 나는 경우가 있어 null로 돌린다 */
export function browserStorage(): RecentStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadRecentAnalyses(storage: RecentStorage | null): RecentAnalysis[] {
  if (storage === null) return []
  try {
    return parseRecentAnalyses(storage.getItem(RECENT_ANALYSES_KEY))
  } catch {
    return []
  }
}

/** 목록을 저장한다. 비었으면 지운다. 저장하지 못하면(용량·권한) 그냥 넘어간다 */
export function saveRecentAnalyses(storage: RecentStorage | null, list: RecentAnalysis[]): void {
  if (storage === null) return
  try {
    if (list.length === 0) {
      storage.removeItem(RECENT_ANALYSES_KEY)
    } else {
      storage.setItem(RECENT_ANALYSES_KEY, JSON.stringify(list))
    }
  } catch {
    // 저장을 쓸 수 없는 브라우저에서는 목록만 빠지고 나머지는 그대로 둔다(FS-7 R3)
  }
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const KST_OFFSET = 9 * HOUR

/**
 * 본 시각 표시. 1분 안은 '방금 전', 1시간 안은 'N분 전', 하루 안은 'N시간 전', 7일 안은 'N일 전',
 * 그보다 오래됐거나 시계가 어긋나 미래면 날짜(2026.10.25)로 보인다. 날짜는 한국 시간 기준이다.
 */
export function viewedAtLabel(viewedAt: string, now: Date): string {
  const time = Date.parse(viewedAt)
  if (Number.isNaN(time)) return ''
  const elapsed = now.getTime() - time
  if (elapsed >= 0 && elapsed < MINUTE) return '방금 전'
  if (elapsed >= 0 && elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}분 전`
  if (elapsed >= 0 && elapsed < DAY) return `${Math.floor(elapsed / HOUR)}시간 전`
  if (elapsed >= 0 && elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}일 전`
  // 한국 시간(UTC+9) 날짜. 서머타임이 없어 고정으로 더한다
  return new Date(time + KST_OFFSET).toISOString().slice(0, 10).replaceAll('-', '.')
}
