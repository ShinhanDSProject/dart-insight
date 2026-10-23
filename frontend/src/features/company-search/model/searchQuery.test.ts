import { describe, expect, it } from 'vitest'
import { validateSearchQuery } from './searchQuery'

describe('validateSearchQuery', () => {
  it('asks for input when empty or only spaces', () => {
    expect(validateSearchQuery('   ')).toBe('회사명이나 종목코드를 입력해 주세요.')
  })

  it('needs at least two characters after trimming', () => {
    expect(validateSearchQuery(' 삼 ')).toBe('2자 이상 입력해 주세요.')
  })

  it('accepts names and stock codes', () => {
    expect(validateSearchQuery('삼성')).toBeNull()
    expect(validateSearchQuery('005930')).toBeNull()
  })
})
