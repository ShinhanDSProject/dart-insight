import { describe, expect, it } from 'vitest'
import { compareLayout, formatShare, shares } from './compare'

describe('compareLayout', () => {
  it('두 양수는 0에서 시작하고 큰 값이 끝까지 간다', () => {
    expect(compareLayout(50, 100)).toEqual({ zero: 0, previous: { left: 0, width: 50 }, current: { left: 0, width: 100 } })
  })

  it('음수는 0의 왼쪽으로 그린다', () => {
    expect(compareLayout(-50, 150)).toEqual({ zero: 25, previous: { left: 0, width: 25 }, current: { left: 25, width: 75 } })
  })

  it('없는 값은 0으로 그리지 않고, 둘 다 없으면 그리지 않는다', () => {
    expect(compareLayout(null, 10)?.previous).toBeNull()
    expect(compareLayout(null, null)).toBeNull()
  })

  it('두 값이 모두 0이면 폭 0으로 둔다', () => {
    expect(compareLayout(0, 0)).toEqual({ zero: 0, previous: { left: 0, width: 0 }, current: { left: 0, width: 0 } })
  })
})

describe('shares', () => {
  it('합에서 차지하는 비율을 낸다', () => {
    expect(shares([1, 1, 2])).toEqual([25, 25, 50])
  })

  it('합이 0이면 모두 0이다', () => {
    expect(shares([0, 0])).toEqual([0, 0])
  })

  it('비율은 소수 한 자리로 보인다', () => {
    expect(formatShare(25.49)).toBe('25.5%')
    expect(formatShare(0)).toBe('0%')
  })
})
