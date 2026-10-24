import { describe, expect, it } from 'vitest'
import { revealScrollLeft } from './scroll'

describe('revealScrollLeft', () => {
  it('항목이 이미 다 보이면 움직이지 않는다', () => {
    expect(revealScrollLeft({ scrollLeft: 0, viewWidth: 300, start: 100, size: 80, inset: 16 })).toBeNull()
  })

  it('항목이 오른쪽으로 잘리면 끝이 여백만큼 보이도록 옮긴다', () => {
    expect(revealScrollLeft({ scrollLeft: 0, viewWidth: 300, start: 260, size: 80, inset: 16 })).toBe(56)
  })

  it('항목이 왼쪽으로 잘리면 시작이 여백만큼 보이도록 옮긴다', () => {
    expect(revealScrollLeft({ scrollLeft: 200, viewWidth: 300, start: 150, size: 80, inset: 16 })).toBe(134)
  })

  it('왼쪽으로 옮길 때 0보다 작게 가지 않는다', () => {
    expect(revealScrollLeft({ scrollLeft: 40, viewWidth: 300, start: 8, size: 80, inset: 16 })).toBe(0)
  })

  it('항목이 보이는 너비보다 넓으면 시작에 맞춘다', () => {
    expect(revealScrollLeft({ scrollLeft: 0, viewWidth: 100, start: 50, size: 200, inset: 16 })).toBe(34)
  })
})
