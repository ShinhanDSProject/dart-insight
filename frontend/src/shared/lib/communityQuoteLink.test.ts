import { describe, expect, it } from 'vitest'
import {
  clearCommunityQuoteParams,
  communityQuotePath,
  hasCommunityQuoteParams,
  parseCommunityQuoteParams,
} from './communityQuoteLink'
import { applyParamChanges } from './searchParams'

describe('communityQuoteLink (#525)', () => {
  it('재무 계정과 문장 변경의 커뮤니티 인용 주소를 조립하고 그대로 읽는다', () => {
    const finUrl = communityQuotePath({
      corpCode: '00126380',
      analysisId: 10,
      kind: 'FINANCIAL_CHANGE',
      changeId: 101,
      sjDiv: 'IS',
    })
    expect(finUrl).toBe('/companies/00126380?view=community&quoteAnalysis=10&quoteKind=FINANCIAL_CHANGE&quoteChange=101&quoteSj=IS')
    expect(parseCommunityQuoteParams(new URLSearchParams(finUrl.split('?')[1]))).toEqual({
      analysisId: 10,
      kind: 'FINANCIAL_CHANGE',
      changeId: 101,
      sjDiv: 'IS',
    })

    const textUrl = communityQuotePath({
      corpCode: '00126380',
      analysisId: 16,
      kind: 'TEXT_CHANGE',
      changeId: 31,
    })
    expect(textUrl).toBe('/companies/00126380?view=community&quoteAnalysis=16&quoteKind=TEXT_CHANGE&quoteChange=31')
    expect(parseCommunityQuoteParams(new URLSearchParams(textUrl.split('?')[1]))).toEqual({
      analysisId: 16,
      kind: 'TEXT_CHANGE',
      changeId: 31,
      sjDiv: null,
    })
  })

  it('잘못된 숫자·종류·재무제표 코드는 null로 거르고 쿼리 키만 지운다', () => {
    expect(parseCommunityQuoteParams(new URLSearchParams('view=community'))).toBeNull()
    expect(parseCommunityQuoteParams(new URLSearchParams('quoteAnalysis=0&quoteKind=TEXT_CHANGE&quoteChange=1'))).toBeNull()
    expect(parseCommunityQuoteParams(new URLSearchParams('quoteAnalysis=10&quoteKind=OTHER&quoteChange=1'))).toBeNull()
    expect(
      parseCommunityQuoteParams(new URLSearchParams('quoteAnalysis=10&quoteKind=FINANCIAL_CHANGE&quoteChange=1&quoteSj=BAD')),
    ).toBeNull()

    const dirty = new URLSearchParams('view=community&quoteAnalysis=abc&current=20260814000123')
    expect(hasCommunityQuoteParams(dirty)).toBe(true)
    const cleaned = applyParamChanges(dirty, clearCommunityQuoteParams)
    expect(hasCommunityQuoteParams(cleaned)).toBe(false)
    expect(cleaned.toString()).toBe('view=community&current=20260814000123')
  })
})
