import { describe, expect, it } from 'vitest'
import { applyParamChanges, positiveInt } from './searchParams'

describe('applyParamChanges', () => {
  it('값은 바꾸고 null은 지우며 나머지는 그대로 둔다', () => {
    const prev = new URLSearchParams('tab=text&sj=BS&keep=1')
    const next = applyParamChanges(prev, { tab: 'financial', sj: null })
    expect(next.toString()).toBe('tab=financial&keep=1')
  })

  it('원래 쿼리는 고치지 않는다', () => {
    const prev = new URLSearchParams('a=1')
    applyParamChanges(prev, { a: null })
    expect(prev.toString()).toBe('a=1')
  })
})

describe('positiveInt', () => {
  it('1 이상의 정수만 숫자로 읽는다', () => {
    expect(positiveInt('3')).toBe(3)
    expect(positiveInt('0')).toBeNull()
    expect(positiveInt('-1')).toBeNull()
    expect(positiveInt('1.5')).toBeNull()
    expect(positiveInt('abc')).toBeNull()
    expect(positiveInt('')).toBeNull()
    expect(positiveInt(null)).toBeNull()
  })
})
