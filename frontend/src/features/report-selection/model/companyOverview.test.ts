import { describe, expect, it } from 'vitest'
import { samsungOverview } from '@/test/fixtures/companyOverview'
import { accountingMonthLabel, corpClassLabel, externalHref, overviewFacts } from './companyOverview'

describe('법인구분 이름', () => {
  it('OpenDART 코드를 시장 이름으로 바꾼다', () => {
    expect(corpClassLabel('Y')).toBe('유가증권시장')
    expect(corpClassLabel('K')).toBe('코스닥')
    expect(corpClassLabel('N')).toBe('코넥스')
    expect(corpClassLabel('E')).toBe('기타')
  })

  it('모르는 값은 원문 그대로, 없으면 null이다', () => {
    expect(corpClassLabel('Z')).toBe('Z')
    expect(corpClassLabel(null)).toBeNull()
  })
})

describe('결산월', () => {
  it('월 숫자에 "월"을 붙이고 없으면 null이다', () => {
    expect(accountingMonthLabel(12)).toBe('12월')
    expect(accountingMonthLabel(null)).toBeNull()
  })
})

describe('홈페이지 링크 주소', () => {
  it('http(s)://가 없으면 http://를 붙인다', () => {
    expect(externalHref('www.samsung.com/sec')).toBe('http://www.samsung.com/sec')
    expect(externalHref(' example.co.kr ')).toBe('http://example.co.kr')
    expect(externalHref('example.co.kr:8080/ir')).toBe('http://example.co.kr:8080/ir')
  })

  it('http(s) 주소는 그대로 쓴다', () => {
    expect(externalHref('https://www.example.com')).toBe('https://www.example.com')
    expect(externalHref('HTTP://www.example.com')).toBe('HTTP://www.example.com')
  })

  it('http(s)가 아닌 주소·공백이 든 값·빈 값은 링크로 만들지 않는다', () => {
    expect(externalHref('javascript:alert(1)')).toBeNull()
    expect(externalHref('mailto:ir@example.com')).toBeNull()
    expect(externalHref('www.example.com 및 www.example.kr')).toBeNull()
    expect(externalHref('')).toBeNull()
    expect(externalHref(null)).toBeNull()
  })
})

describe('개황 카드 줄', () => {
  it('OpenDART 값을 순서대로 담고 날짜·월·법인구분만 읽기 쉽게 바꾼다', () => {
    const facts = overviewFacts(samsungOverview)

    expect(facts.map((f) => f.label)).toEqual([
      '정식명칭',
      '영문명칭',
      '대표자',
      '법인구분',
      '종목코드',
      '업종코드',
      '설립일',
      '결산월',
      '홈페이지',
      'IR 홈페이지',
      '주소',
      '전화번호',
    ])
    expect(facts.find((f) => f.label === '대표자')?.value).toBe('전영현, 노태문')
    expect(facts.find((f) => f.label === '법인구분')?.value).toBe('유가증권시장')
    expect(facts.find((f) => f.label === '설립일')?.value).toBe('1969.01.13')
    expect(facts.find((f) => f.label === '결산월')?.value).toBe('12월')
    expect(facts.find((f) => f.label === '주소')?.value).toBe('경기도 수원시 영통구  삼성로 129 (매탄동)')
    expect(facts.find((f) => f.label === '홈페이지')).toEqual({
      label: '홈페이지',
      value: 'www.samsung.com/sec',
      href: 'http://www.samsung.com/sec',
    })
  })

  it('없는 값은 null로 둔다(0이나 빈 문자열로 바꾸지 않음)', () => {
    const facts = overviewFacts({ ...samsungOverview, establishedDate: null, accountingMonth: null })

    expect(facts.find((f) => f.label === 'IR 홈페이지')).toEqual({ label: 'IR 홈페이지', value: null, href: null })
    expect(facts.find((f) => f.label === '설립일')?.value).toBeNull()
    expect(facts.find((f) => f.label === '결산월')?.value).toBeNull()
  })
})
