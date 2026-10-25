import { describe, expect, it } from 'vitest'
import { numberChanges, numberTokens } from './numberChanges'

describe('numberTokens', () => {
  it('쉼표·소수점·퍼센트를 원문 그대로 뽑는다', () => {
    expect(numberTokens('매출 1,234,567원, 비율 12.5%, 금리 0.25%p')).toEqual(['1,234,567원', '12.5%', '0.25%p'])
  })

  it('바로 뒤의 단위 한 낱말만 붙이고 조사는 떼어 낸다', () => {
    expect(numberTokens('230개의 종속기업과 1,200명이 3개월 동안')).toEqual(['230개', '1,200명', '3개월'])
  })

  it('날짜는 숫자 여러 개로 뽑는다', () => {
    expect(numberTokens('2025년 6월 30일 현재')).toEqual(['2025년', '6월', '30일'])
  })

  it('△·괄호·마이너스 음수 표기를 그대로 둔다', () => {
    expect(numberTokens('손실 △1,234백만원, (567), -3.5%')).toEqual(['△1,234백만원', '(567)', '-3.5%'])
  })

  it('낱말에 붙은 붙임표는 부호로 보지 않는다', () => {
    expect(numberTokens('A-1 등급')).toEqual(['1'])
  })

  it('숫자가 없으면 빈 목록이다', () => {
    expect(numberTokens('숫자가 없는 문장')).toEqual([])
  })
})

describe('numberChanges', () => {
  it('같은 위치의 숫자끼리 짝짓고 달라진 쌍만 남긴다', () => {
    expect(
      numberChanges('2024년 말 230개의 종속기업과 33개의 관계기업이 있어요.', '2025년 말 309개의 종속기업과 36개의 관계기업이 있어요.'),
    ).toEqual({
      pairs: [
        { before: '2024년', after: '2025년' },
        { before: '230개', after: '309개' },
        { before: '33개', after: '36개' },
      ],
      rest: 0,
    })
  })

  it('같은 숫자는 빼고 바뀐 날짜 숫자만 보인다', () => {
    expect(numberChanges('2024년 6월 30일 기준', '2025년 6월 30일 기준')).toEqual({
      pairs: [{ before: '2024년', after: '2025년' }],
      rest: 0,
    })
  })

  it('음수 표기가 바뀐 것도 쌍으로 보인다', () => {
    expect(numberChanges('영업손익 △1,234원', '영업손익 2,345원')).toEqual({
      pairs: [{ before: '△1,234원', after: '2,345원' }],
      rest: 0,
    })
  })

  it('한쪽 글이 없으면 null이다', () => {
    expect(numberChanges(null, '309개')).toBeNull()
    expect(numberChanges('230개', null)).toBeNull()
  })

  it('미리보기가 잘렸으면(…) null이다', () => {
    expect(numberChanges('…230개의 종속기업', '…309개의 종속기업')).toBeNull()
    expect(numberChanges('230개의 종속기업…', '309개의 종속기업')).toBeNull()
  })

  it('숫자 개수가 다르면 null이다', () => {
    expect(numberChanges('230개와 33개', '309개')).toBeNull()
  })

  it('달라진 숫자가 없으면 null이다', () => {
    expect(numberChanges('230개 회사', '230개의 회사')).toBeNull()
  })

  it('최대 개수까지만 보이고 나머지는 수로 센다', () => {
    const result = numberChanges('1 2 3 4 5 6 7', '11 12 13 14 15 16 17')
    expect(result?.pairs).toHaveLength(5)
    expect(result?.pairs[4]).toEqual({ before: '5', after: '15' })
    expect(result?.rest).toBe(2)
    expect(numberChanges('1 2 3', '4 5 6', 2)?.rest).toBe(1)
  })
})
