import { describe, expect, it } from 'vitest'
import { aiInfoLabel, explanationNote, kindLabel, summaryLink, summaryStatusNotice, textCoverageNote } from './summaryLabels'

describe('summaryLabels', () => {
  it('요약 상태가 정상이면 안내가 없고, 아니면 사유를 보여 준다', () => {
    expect(summaryStatusNotice('COMPLETED', null)).toBeNull()
    expect(summaryStatusNotice('PARTIAL', null)).toContain('검토 필요')
    expect(summaryStatusNotice('EMPTY', '요약할 변화가 없어요.')).toBe('요약할 변화가 없어요.')
    expect(summaryStatusNotice(null, null)).toContain('다시 요청하면')
  })

  it('문장을 비교하지 못했으면 재무 수치만 요약했다고 알린다', () => {
    expect(textCoverageNote('COMPLETED')).toBeNull()
    expect(textCoverageNote('FAILED')).toContain('재무 수치 변화만')
    expect(textCoverageNote(null)).toContain('재무 수치 변화만')
  })

  it("설명이 없으면 '확인된 설명 없음', 근거를 확인하지 못했으면 '검토 필요'", () => {
    expect(explanationNote('FOUND')).toBeNull()
    expect(explanationNote('NOT_FOUND')).toMatch(/^확인된 설명 없음/)
    expect(explanationNote('REVIEW_NEEDED')).toMatch(/^검토 필요/)
  })

  it('AI 생성 정보는 모델·프롬프트 버전·생성 시각을 보여 준다', () => {
    expect(aiInfoLabel({ model: 'fake-model', promptVersion: 'summary-1', generatedAt: '2026-10-22T09:00:00' })).toBe(
      'fake-model · 프롬프트 summary-1 · 2026-10-22 09:00 생성',
    )
    expect(aiInfoLabel(null)).toBe('')
    expect(kindLabel('TEXT')).toBe('문장 변화')
  })

  it('요약 항목은 열 수 있는 결과로만 이어진다', () => {
    expect(summaryLink({ type: 'FINANCIAL', changeId: 3, sjDiv: 'IS' })).toEqual({ tab: 'financial', sjDiv: 'IS', changeId: 3 })
    expect(summaryLink({ type: 'TEXT', changeId: 7, sjDiv: null })).toEqual({ tab: 'text', changeId: 7 })
    expect(summaryLink({ type: 'FINANCIAL', changeId: 3, sjDiv: null })).toBeNull()
    expect(summaryLink({ type: 'TEXT', changeId: null, sjDiv: null })).toBeNull()
  })
})
