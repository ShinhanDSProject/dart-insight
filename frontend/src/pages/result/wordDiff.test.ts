import { describe, expect, it } from 'vitest'
import { wordDiff } from './wordDiff'

const changed = (parts: { text: string; changed: boolean }[]) =>
  parts.filter((p) => p.changed && p.text.trim() !== '').map((p) => p.text.trim())

describe('wordDiff', () => {
  it('바뀐 낱말만 표시한다', () => {
    const diff = wordDiff('당사는 메모리를 만듭니다.', '당사는 메모리와 파운드리를 만듭니다.')

    expect(diff).not.toBeNull()
    expect(changed(diff!.previous)).toEqual(['메모리를'])
    expect(changed(diff!.current)).toEqual(['메모리와', '파운드리를'])
    expect(diff!.current.map((p) => p.text).join('')).toBe('당사는 메모리와 파운드리를 만듭니다.')
  })

  it('같은 글은 바뀐 곳이 없다', () => {
    const diff = wordDiff('같은 글', '같은 글')

    expect(changed(diff!.previous)).toEqual([])
    expect(changed(diff!.current)).toEqual([])
  })

  it('너무 긴 글은 계산하지 않는다', () => {
    const long = Array.from({ length: 1000 }, (_, i) => `낱말${i}`).join(' ')

    expect(wordDiff(long, long + ' 끝')).toBeNull()
  })
})
