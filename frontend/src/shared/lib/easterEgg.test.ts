import { describe, expect, it } from 'vitest'
import { KONAMI_KEYS, nextKonamiStep, type EasterEggKey } from './easterEgg'

function key(k: string, overrides: Partial<EasterEggKey> = {}): EasterEggKey {
  return { key: k, ctrlKey: false, metaKey: false, altKey: false, target: { tagName: 'BODY', isContentEditable: false }, ...overrides }
}

function run(keys: readonly string[], start = 0): number {
  return keys.reduce((step, k) => nextKonamiStep(step, key(k)), start)
}

describe('nextKonamiStep', () => {
  it('코나미 코드를 끝까지 누르면 전체 길이가 된다(B·A는 대문자도 센다)', () => {
    expect(run(KONAMI_KEYS)).toBe(KONAMI_KEYS.length)
    expect(run([...KONAMI_KEYS.slice(0, 8), 'B', 'A'])).toBe(KONAMI_KEYS.length)
  })

  it('틀린 키를 누르면 처음부터 다시 센다', () => {
    expect(run(['ArrowUp', 'ArrowUp', 'ArrowDown', 'x'])).toBe(0)
  })

  it('↑를 세 번 눌러도 마지막 두 번부터 이어서 센다', () => {
    expect(run(['ArrowUp', 'ArrowUp', 'ArrowUp', ...KONAMI_KEYS.slice(2)])).toBe(KONAMI_KEYS.length)
  })

  it('입력창에서 누른 키와 조합키는 세지 않는다', () => {
    expect(nextKonamiStep(3, key('ArrowDown', { target: { tagName: 'INPUT', isContentEditable: false } }))).toBe(0)
    expect(nextKonamiStep(9, key('a', { metaKey: true }))).toBe(0)
  })
})
