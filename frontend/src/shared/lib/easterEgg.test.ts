import { describe, expect, it } from 'vitest'
import { DOUBLE_SHIFT_MS, nextShiftTap, type EasterEggKey } from './easterEgg'

function key(k: string, overrides: Partial<EasterEggKey> = {}): EasterEggKey {
  return { key: k, ctrlKey: false, metaKey: false, altKey: false, repeat: false, target: { tagName: 'BODY', isContentEditable: false }, ...overrides }
}

describe('nextShiftTap', () => {
  it('Shift를 정해진 간격 안에 두 번 누르면 찾는다', () => {
    const first = nextShiftTap(null, key('Shift'), 1000)
    expect(first).toEqual({ lastShiftAt: 1000, found: false })
    expect(nextShiftTap(first.lastShiftAt, key('Shift'), 1000 + DOUBLE_SHIFT_MS).found).toBe(true)
  })

  it('간격이 길면 두 번째 Shift부터 다시 센다', () => {
    expect(nextShiftTap(1000, key('Shift'), 1000 + DOUBLE_SHIFT_MS + 1)).toEqual({ lastShiftAt: 1000 + DOUBLE_SHIFT_MS + 1, found: false })
  })

  it('사이에 다른 키를 누르면 처음부터 센다(대문자 입력처럼 Shift+글자)', () => {
    expect(nextShiftTap(1000, key('A'), 1100)).toEqual({ lastShiftAt: null, found: false })
  })

  it('입력창, 조합키, 누르고 있는 반복은 세지 않는다', () => {
    expect(nextShiftTap(1000, key('Shift', { target: { tagName: 'INPUT', isContentEditable: false } }), 1100).found).toBe(false)
    expect(nextShiftTap(1000, key('Shift', { metaKey: true }), 1100).found).toBe(false)
    expect(nextShiftTap(1000, key('Shift', { repeat: true }), 1100).found).toBe(false)
  })
})
