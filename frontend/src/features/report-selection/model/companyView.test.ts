import { describe, expect, it } from 'vitest'
import { companyViewChanges, parseCompanyView } from './companyView'

describe('기업 화면 탭 주소', () => {
  it('?view=overview면 기업 개요다', () => {
    expect(parseCompanyView(new URLSearchParams('view=overview'))).toBe('overview')
  })

  it('?view=compare면 보고서 비교다', () => {
    expect(parseCompanyView(new URLSearchParams('view=compare&current=20260814001234'))).toBe('compare')
  })

  it('?view=community면 커뮤니티다', () => {
    expect(parseCompanyView(new URLSearchParams('view=community'))).toBe('community')
    expect(companyViewChanges('community')).toEqual({ view: 'community' })
  })

  it('?view가 없거나 모르는 값이면 기존 흐름대로 보고서 비교다', () => {
    expect(parseCompanyView(new URLSearchParams(''))).toBe('compare')
    expect(parseCompanyView(new URLSearchParams('current=20260814001234&basis=YOY'))).toBe('compare')
    expect(parseCompanyView(new URLSearchParams('view=OVERVIEW'))).toBe('compare')
    expect(parseCompanyView(new URLSearchParams('view=summary'))).toBe('compare')
  })

  it('기업 개요로 바꾸면 ?view=overview를 적고, 보고서 비교로 바꾸면 ?view를 지운다', () => {
    expect(companyViewChanges('overview')).toEqual({ view: 'overview' })
    expect(companyViewChanges('compare')).toEqual({ view: null })
  })
})
