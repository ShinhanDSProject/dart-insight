import { describe, expect, it } from 'vitest'
import { validateSearchQuery } from './searchQuery'

describe('validateSearchQuery', () => {
  it('비어 있거나 공백뿐이면 입력을 요청한다', () => {
    expect(validateSearchQuery('   ')).toBe('회사명이나 종목코드를 입력해 주세요.')
  })

  it('앞뒤 공백을 뺀 뒤 2자 미만이면 거부한다', () => {
    expect(validateSearchQuery(' 삼 ')).toBe('2자 이상 입력해 주세요.')
  })

  it('회사명과 종목코드는 받아들인다', () => {
    expect(validateSearchQuery('삼성')).toBeNull()
    expect(validateSearchQuery('005930')).toBeNull()
  })
})
