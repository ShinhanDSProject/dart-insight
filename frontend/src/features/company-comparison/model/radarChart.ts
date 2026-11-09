import type { TrendValue } from '@/shared/api/financialTrends'
import { formatRatio, type RatioResult } from '@/shared/lib/financialRatios'
import { ACCOUNT_ROWS, isReady, type ComparisonColumn } from './companyComparison'

/**
 * 기업 나란히 보기 방사형 그래프(#778). 축은 비율 4개(RATIO_DEFINITIONS 순서)와 전년 동기 대비 증가율 2개다.
 * 눈금은 고른 기업끼리의 상대 위치이고 축 방향을 뒤집지 않는다(좋음·나쁨을 정하지 않음).
 */

export const RADAR_AXES = ['부채비율', '유동비율', '영업이익률', '순이익률', '매출액 증가율', '영업이익 증가율'] as const

/** 가장 작은 값의 반지름. 0이면 중심에 붙어 면이 사라져 보여서 띄운다 */
const MIN_RADIUS = 0.2
/** 축의 값이 모두 같을 때 반지름 */
const SAME_RADIUS = 0.6

export interface RadarSeries {
  corpCode: string
  name: string
  /** RADAR_AXES 순서. 계산하지 못하면 null */
  values: (number | null)[]
}

type RadarInput = Pick<ComparisonColumn, 'corpCode' | 'name'> & {
  amounts: (Pick<TrendValue, 'amount'> | null)[]
  previousAmounts: (Pick<TrendValue, 'amount'> | null)[] | null
  ratios: Pick<RatioResult, 'value'>[]
}

/** 전년 동기 대비 증가율(%). 전년 값이 없거나 0·음수, 이번 값이 음수(적자 전환 등)면 계산하지 않는다 */
export function growthRate(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous <= 0 || current < 0) return null
  return ((current - previous) / previous) * 100
}

function accountGrowth(column: RadarInput, key: (typeof ACCOUNT_ROWS)[number]['key']): number | null {
  const row = ACCOUNT_ROWS.findIndex((account) => account.key === key)
  return growthRate(column.amounts[row]?.amount ?? null, column.previousAmounts?.[row]?.amount ?? null)
}

export function seriesOf(column: RadarInput): RadarSeries {
  return {
    corpCode: column.corpCode,
    name: column.name,
    values: [
      ...column.ratios.map((ratio) => ratio.value),
      accountGrowth(column, 'REVENUE'),
      accountGrowth(column, 'OPERATING_INCOME'),
    ],
  }
}

/** 수치가 준비된 기업만, 고른 순서대로 */
export function radarSeries(columns: readonly ComparisonColumn[]): RadarSeries[] {
  return columns.filter(isReady).map(seriesOf)
}

/** 축마다 가장 작은 값을 MIN_RADIUS, 가장 큰 값을 1로 두는 반지름. 값이 없으면 null */
export function radarRadii(series: readonly RadarSeries[]): (number | null)[][] {
  const ranges = RADAR_AXES.map((_, axis) => {
    const values = series.map((s) => s.values[axis]).filter((v): v is number => v !== null)
    return { min: Math.min(...values), max: Math.max(...values) }
  })
  return series.map((s) =>
    s.values.map((value, axis) => {
      if (value === null) return null
      const { min, max } = ranges[axis]
      return max === min ? SAME_RADIUS : MIN_RADIUS + ((1 - MIN_RADIUS) * (value - min)) / (max - min)
    }),
  )
}

/** 이웃한 두 축에 모두 값이 있을 때만 잇는 선분(축 번호 쌍). 계산 불가 축을 건너뛰어 잇지 않는다 */
export function radarEdges(radii: readonly (number | null)[]): [number, number][] {
  return radii.flatMap((r, axis): [number, number][] => {
    const next = (axis + 1) % radii.length
    return r !== null && radii[next] !== null ? [[axis, next]] : []
  })
}

/** 축 값 표시. 증가율은 부호를 붙인다 */
export function formatRadarValue(axis: number, value: number | null): string {
  const text = formatRatio(value)
  if (text === null) return '계산 불가'
  return axis >= 4 && value !== null && Math.round(value * 10) > 0 ? `+${text}` : text
}
