import { describe, expect, it } from 'vitest'
import { formatRadarValue, growthRate, radarEdges, radarRadii, seriesOf, type RadarSeries } from './radarChart'

function amounts(revenue: number | null, operatingIncome: number | null) {
  return [{ amount: revenue }, { amount: operatingIncome }, null, null, null, null]
}

describe('방사형 그래프 축 값', () => {
  it('증가율은 전년 값이 0보다 클 때만 계산하고 적자 전환·전년 음수·자료 없음은 계산하지 않는다', () => {
    expect(growthRate(120, 100)).toBe(20)
    expect(growthRate(80, 100)).toBe(-20)
    expect(growthRate(-10, 100)).toBeNull()
    expect(growthRate(10, -5)).toBeNull()
    expect(growthRate(10, 0)).toBeNull()
    expect(growthRate(null, 100)).toBeNull()
    expect(growthRate(100, null)).toBeNull()
  })

  it('비율 4개 뒤에 매출액·영업이익 증가율을 둔다', () => {
    const series = seriesOf({
      corpCode: '00000001',
      name: '가',
      amounts: amounts(110, 50),
      previousAmounts: amounts(100, 100),
      ratios: [{ value: 150 }, { value: 120 }, { value: null }, { value: 5 }],
    })
    expect(series.values).toEqual([150, 120, null, 5, 10, -50])
    expect(seriesOf({ ...series, amounts: amounts(110, 50), previousAmounts: null, ratios: [] }).values).toEqual([null, null])
  })
})

describe('방사형 그래프 눈금', () => {
  const series = (values: (number | null)[]): RadarSeries => ({ corpCode: String(values[0]), name: '', values })

  it('축마다 가장 작은 값은 0.2, 가장 큰 값은 1이고 방향을 뒤집지 않는다', () => {
    const radii = radarRadii([series([100, 0, 0, 0, 0, 0]), series([300, 0, 0, 0, 0, 0]), series([200, 0, 0, 0, 0, 0])])
    expect(radii[0][0]).toBe(0.2)
    expect(radii[1][0]).toBe(1)
    expect(radii[2][0]).toBeCloseTo(0.6)
  })

  it('값이 모두 같으면 가운데, 없는 값은 null이다', () => {
    const radii = radarRadii([series([5, null, 1, 1, 1, 1]), series([5, 3, 1, 1, 1, 1])])
    expect(radii[0][0]).toBe(0.6)
    expect(radii[0][1]).toBeNull()
    expect(radii[1][1]).toBe(0.6)
  })

  it('계산 불가 축은 건너뛰어 잇지 않고 이웃한 두 축에 값이 있을 때만 잇는다', () => {
    expect(radarEdges([0.2, 0.5, null, 1, 0.6, 0.3])).toEqual([
      [0, 1],
      [3, 4],
      [4, 5],
      [5, 0],
    ])
    expect(radarEdges([0.2, null, 0.4, null, 0.6, null])).toEqual([])
  })

  it('증가율은 부호를 붙이고 계산하지 못한 값은 계산 불가다', () => {
    expect(formatRadarValue(4, 12.34)).toBe('+12.3%')
    expect(formatRadarValue(5, -3)).toBe('−3.0%')
    expect(formatRadarValue(0, 142)).toBe('142.0%')
    expect(formatRadarValue(1, null)).toBe('계산 불가')
  })
})
