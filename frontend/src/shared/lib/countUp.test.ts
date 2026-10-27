import { describe, expect, it } from 'vitest'
import { countUpValue, easeOutCubic, parseDurationMs } from './countUp'

describe('easeOutCubic', () => {
  it('처음은 0, 끝은 1이고 가운데는 직선보다 앞서 간다', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875)
  })

  it('범위 밖의 진행도는 0과 1로 자른다', () => {
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(2)).toBe(1)
  })
})

describe('countUpValue', () => {
  it('시간이 다 되면 정확히 목표 값이다', () => {
    expect(countUpValue(0, 1234567, 600, 600)).toBe(1234567)
    expect(countUpValue(0, 1234567, 900, 600)).toBe(1234567)
  })

  it('시간이 0이면(동작 줄이기) 바로 목표 값이다', () => {
    expect(countUpValue(0, -500, 0, 0)).toBe(-500)
  })

  it('중간에는 시작과 목표 사이 값이고 음수로도 간다', () => {
    expect(countUpValue(0, 100, 300, 600)).toBeCloseTo(87.5)
    expect(countUpValue(100, -100, 300, 600)).toBeCloseTo(-75)
  })
})

describe('parseDurationMs', () => {
  it('ms와 s 단위를 ms로 읽는다', () => {
    expect(parseDurationMs('600ms')).toBe(600)
    expect(parseDurationMs(' 0.6s ')).toBe(600)
  })

  it('읽을 수 없는 값은 null이다', () => {
    expect(parseDurationMs('')).toBeNull()
    expect(parseDurationMs('fast')).toBeNull()
    expect(parseDurationMs('-1ms')).toBeNull()
  })
})
