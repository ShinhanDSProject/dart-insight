import { describe, expect, it } from 'vitest'
import type { CompanyAnalysisItem } from '@/shared/api/analyses'
import type { PostQuote } from '@/shared/api/community'
import type { StatementSummary } from '@/shared/api/results'
import {
  accountName,
  amountChangeLabel,
  quoteKindLabel,
  quoteLink,
  searchQuery,
  statementOptions,
  textPick,
} from './postQuote'

const source: PostQuote['source'] = { analysisId: 42, changeId: 3001, rceptNo: '20261114001234', sectionNo: 12, blockNo: 340 }

describe('인용 카드', () => {
  it('문장은 ?tab=text&tc=, 재무는 ?tab=financial&sj=&change=로 결과 화면의 그 변경에 간다', () => {
    expect(quoteLink({ kind: 'TEXT_CHANGE', sjDiv: null, source })).toBe('/analyses/42?tab=text&tc=3001')
    expect(quoteLink({ kind: 'FINANCIAL_CHANGE', sjDiv: 'IS', source: { ...source, changeId: 501 } })).toBe(
      '/analyses/42?tab=financial&sj=IS&change=501',
    )
  })

  it('배지는 문장이면 변경 유형을 붙이고, 모르는 유형이면 종류만 보인다', () => {
    expect(quoteKindLabel({ kind: 'TEXT_CHANGE', changeType: 'NUMERIC_UPDATE' })).toBe('문장 변경 · 숫자만 바뀜')
    expect(quoteKindLabel({ kind: 'TEXT_CHANGE', changeType: 'UNKNOWN' })).toBe('문장 변경')
    expect(quoteKindLabel({ kind: 'FINANCIAL_CHANGE', changeType: null })).toBe('재무 계정')
  })
})

describe('변경점 고르기', () => {
  const analysis: CompanyAnalysisItem = {
    analysisId: 42,
    basis: 'YOY',
    previous: { rceptNo: 'P', reportName: '사업보고서 (2024.12)', periodEnd: '2024-12-31' },
    current: { rceptNo: 'C', reportName: '사업보고서 (2025.12)', periodEnd: '2025-12-31' },
    completedAt: '2026-10-27T09:00:00',
  }

  it('지운 문장은 이전 쪽 글을 미리보기로 쓰고, 보낼 것은 종류·분석·변경 ID뿐이다', () => {
    const pick = textPick(analysis, {
      changeId: 7,
      changeType: 'DELETED',
      sectionPath: 'II. 사업의 내용',
      currentPreview: null,
      previousPreview: '빠진 문단',
      reviewReason: null,
    } as Parameters<typeof textPick>[1])
    expect(pick.request).toEqual({ kind: 'TEXT_CHANGE', analysisId: 42, changeId: 7 })
    expect(pick.text).toBe('빠진 문단')
    expect(pick.reportPair).toEqual({ previous: '사업보고서 (2024.12)', current: '사업보고서 (2025.12)' })
  })

  it('없는 값은 0이 아니라 없음이고, 자본변동표는 구성요소를 붙인다', () => {
    expect(amountChangeLabel({ previousAmount: null, currentAmount: 1200 })).toBe('이전 없음 → 현재 1,200')
    expect(amountChangeLabel({ previousAmount: 0, currentAmount: 5 })).toBe('이전 0 → 현재 5')
    expect(accountName({ accountName: '이익잉여금', accountDetail: '자본금' })).toBe('이익잉여금 · 자본금')
  })

  it('재무제표는 비교할 수 있고 바뀐 계정이 있는 것만 고른다', () => {
    const s = (sjDiv: StatementSummary['sjDiv'], comparable: boolean, changed: number): StatementSummary => ({
      sjDiv, label: sjDiv, comparable, amountBasis: null, note: null, total: 1, changed,
    })
    expect(statementOptions([s('BS', true, 2), s('IS', false, 3), s('CF', true, 0)]).map((o) => o.value)).toEqual(['BS'])
  })

  it('문장 찾기는 앞뒤 공백을 지운 두 글자 이상만 보낸다', () => {
    expect(searchQuery(' H ')).toBeNull()
    expect(searchQuery(' HBM ')).toBe('HBM')
  })
})
