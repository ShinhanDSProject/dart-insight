import { describe, expect, it } from 'vitest'
import { ACCOUNT_SEARCH_MAX_LENGTH, accountQueryOf, filterAccounts, foundAccountsLabel } from './accountFilter'

const items = [
  { changeId: 1, accountName: '단기차입금' },
  { changeId: 2, accountName: '장기 차입금' },
  { changeId: 3, accountName: '매출채권' },
  { changeId: 4, accountName: 'EBITDA 조정' },
]

describe('filterAccounts', () => {
  it('계정 이름에 검색어가 들어 있는 계정만 원래 순서대로 남긴다', () => {
    expect(filterAccounts(items, '차입금').map((i) => i.changeId)).toEqual([1, 2])
  })

  it('계정 이름과 검색어의 공백을 무시한다', () => {
    expect(filterAccounts(items, '장기차입금').map((i) => i.changeId)).toEqual([2])
    expect(filterAccounts(items, '단기 차입 금').map((i) => i.changeId)).toEqual([1])
  })

  it('영문 대소문자를 무시한다', () => {
    expect(filterAccounts(items, 'ebitda').map((i) => i.changeId)).toEqual([4])
  })

  it('검색어가 없거나 공백뿐이면 모든 계정을 그대로 돌려준다', () => {
    expect(filterAccounts(items, null)).toBe(items)
    expect(filterAccounts(items, '  ')).toBe(items)
  })

  it('맞는 계정이 없으면 빈 목록을 돌려준다', () => {
    expect(filterAccounts(items, '영업권')).toEqual([])
  })
})

describe('accountQueryOf', () => {
  it('앞뒤 공백을 지우고 공백뿐이면 null로 본다', () => {
    expect(accountQueryOf('  차입금 ')).toBe('차입금')
    expect(accountQueryOf('   ')).toBeNull()
    expect(accountQueryOf('')).toBeNull()
  })

  it('한 글자도 검색어로 쓴다', () => {
    expect(accountQueryOf('금')).toBe('금')
  })

  it('너무 긴 검색어는 최대 길이로 자른다', () => {
    expect(accountQueryOf('가'.repeat(ACCOUNT_SEARCH_MAX_LENGTH + 10))).toHaveLength(ACCOUNT_SEARCH_MAX_LENGTH)
  })
})

describe('foundAccountsLabel', () => {
  it('찾은 계정 수를 문구로 만든다', () => {
    expect(foundAccountsLabel(3)).toBe('찾은 계정 3개')
  })
})
