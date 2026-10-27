import { describe, expect, it } from 'vitest'
import { isLookupQuery, nextResultFocus } from './companyPicker'

describe('기업 고르기 검색어', () => {
  it('앞뒤 공백을 뺀 2자 이상만 찾는다', () => {
    expect(isLookupQuery(' 삼 ')).toBe(false)
    expect(isLookupQuery('삼성')).toBe(true)
  })
})

describe('검색 결과 키보드 이동(#426)', () => {
  it('입력칸에서 ↓를 누르면 첫 결과로 가고, 다른 키는 그대로 둔다', () => {
    expect(nextResultFocus(null, 'ArrowDown', 3)).toBe(0)
    expect(nextResultFocus(null, 'ArrowUp', 3)).toBeNull()
    expect(nextResultFocus(null, 'Enter', 3)).toBeNull()
  })

  it('결과에서 ↓·↑로 옮기고, 마지막에서 ↓는 그대로, 첫 결과에서 ↑는 입력칸으로 간다', () => {
    expect(nextResultFocus(0, 'ArrowDown', 3)).toBe(1)
    expect(nextResultFocus(2, 'ArrowDown', 3)).toBeNull()
    expect(nextResultFocus(2, 'ArrowUp', 3)).toBe(1)
    expect(nextResultFocus(0, 'ArrowUp', 3)).toBe('input')
  })

  it('Home·End는 처음·끝 결과로 간다', () => {
    expect(nextResultFocus(1, 'Home', 3)).toBe(0)
    expect(nextResultFocus(0, 'End', 3)).toBe(2)
  })

  it('고를 수 있는 결과가 없으면 옮기지 않는다', () => {
    expect(nextResultFocus(null, 'ArrowDown', 0)).toBeNull()
  })
})
