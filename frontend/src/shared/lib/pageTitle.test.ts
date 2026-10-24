import { describe, expect, it } from 'vitest'
import { APP_TITLE, companyPageTitle, pageTitle } from './pageTitle'

describe('pageTitle', () => {
  it('화면 이름 뒤에 서비스 이름을 붙인다', () => {
    expect(pageTitle(['기업 검색'])).toBe('기업 검색 · DART Insight')
  })

  it('여러 조각은 앞에서부터 가운뎃점으로 잇는다', () => {
    expect(pageTitle(['삼성전자 사업보고서 (2024.12) → 반기보고서 (2025.06)', 'AI 질문'])).toBe(
      '삼성전자 사업보고서 (2024.12) → 반기보고서 (2025.06) · AI 질문 · DART Insight',
    )
  })

  it('null·undefined·빈 문자열·공백뿐인 조각은 뺀다', () => {
    expect(pageTitle([null, '분석 결과', undefined, '', '  '])).toBe('분석 결과 · DART Insight')
  })

  it('조각 앞뒤 공백은 지운다', () => {
    expect(pageTitle(['  로그인 '])).toBe('로그인 · DART Insight')
  })

  it('남는 조각이 없으면 서비스 이름만 쓴다', () => {
    expect(pageTitle([])).toBe(APP_TITLE)
    expect(pageTitle([null, ''])).toBe('DART Insight')
  })
})

describe('companyPageTitle', () => {
  it('회사명 뒤에 화면 이름을 붙인다', () => {
    expect(companyPageTitle('삼성전자', '보고서 고르기')).toBe('삼성전자 보고서 고르기 · DART Insight')
  })

  it('기업 정보를 불러오기 전에는 화면 이름만 쓴다', () => {
    expect(companyPageTitle(null, '비교 확인')).toBe('비교 확인 · DART Insight')
  })
})
