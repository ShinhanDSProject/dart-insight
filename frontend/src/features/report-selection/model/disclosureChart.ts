import type { DisclosureGroupCount, DisclosureItem } from '@/shared/api/disclosures'
import { verifiedDartUrl } from '@/shared/lib/dart'
import type { DotTimelinePoint, DotTimelineRow } from '@/shared/ui'
import { compareWithReportPath } from './disclosureTimeline'

/** 공시 타임라인 차트가 보는 기간(최근 1년). API 최대값이다 */
export const CHART_DAYS = 365

/** 표 보기에서 처음 보이는 행 수. '더 보기'로 이만큼씩 더 보인다 */
export const CHART_TABLE_PAGE_SIZE = 20

/** 이보다 좁은 화면은 처음부터 표로 보여 준다(점이 너무 촘촘해져서) */
export const NARROW_CHART_QUERY = '(max-width: 600px)'

export type ChartView = 'chart' | 'table'

export function defaultChartView(narrow: boolean): ChartView {
  return narrow ? 'table' : 'chart'
}

/** 묶음 줄. 서버가 준 6개 묶음을 서버 순서 그대로(0건 줄도 둔다) */
export function chartRows(groups: readonly DisclosureGroupCount[]): DotTimelineRow[] {
  return groups.map((g) => ({ key: g.group, label: g.label, count: g.count }))
}

/**
 * 공시 하나 = 점 하나. 원문 주소가 이 접수번호를 가리킬 때만 링크를 걸고,
 * 정기보고서(periodic)는 마름모로 그리고 툴팁에 '이 보고서로 비교하기'를 둔다(최근 공시 목록과 같은 주소).
 */
export function chartPoints(corpCode: string, items: readonly DisclosureItem[]): DotTimelinePoint[] {
  return items.map((item) => ({
    id: item.rceptNo,
    row: item.group,
    date: item.receivedDate,
    title: item.reportName,
    href: verifiedDartUrl(item.rceptNo, item.dartUrl),
    emphasis: item.periodic,
    action: item.periodic ? { label: '이 보고서로 비교하기', to: compareWithReportPath(corpCode, item.rceptNo) } : undefined,
  }))
}
