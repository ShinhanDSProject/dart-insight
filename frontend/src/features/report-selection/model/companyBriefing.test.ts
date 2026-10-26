import { describe, expect, it } from 'vitest'
import { briefingAiLabel, evidenceLocation, quoteLines, toggleOpen } from './companyBriefing'

describe('기업 브리핑 표시', () => {
  it('모델·프롬프트 버전·생성 시각을 한 줄로 보인다', () => {
    expect(briefingAiLabel({ model: 'fake-model', promptVersion: 'briefing-1', generatedAt: '2026-10-26T10:12:03' })).toBe(
      'fake-model · 프롬프트 briefing-1 · 2026-10-26 10:12 생성',
    )
    expect(briefingAiLabel({ model: 'fake-model', promptVersion: null, generatedAt: null })).toBe('fake-model')
    expect(briefingAiLabel(null)).toBe('')
  })

  it('근거 위치는 섹션 경로와 블록 번호로 보이고, 경로가 없으면 확인 안 됨이라고 쓴다', () => {
    const evidence = {
      evidenceId: '20260310000123#B120',
      rceptNo: '20260310000123',
      sectionNo: 12,
      blockNo: 120,
      sectionPath: 'II. 사업의 내용 > 1. 사업의 개요',
      quote: '당사는 …',
    }
    expect(evidenceLocation(evidence)).toContain('사업의 내용')
    expect(evidenceLocation(evidence)).toMatch(/· 블록 120$/)
    expect(evidenceLocation({ ...evidence, sectionPath: '' })).toBe('위치 확인 안 됨 · 블록 120')
  })

  it('인용 글을 줄로 나누고 빈 줄을 뺀다', () => {
    expect(quoteLines('제품 | 비중\n\n 스마트폰 | 58.1% \n')).toEqual(['제품 | 비중', '스마트폰 | 58.1%'])
  })

  it('근거는 하나만 펼치고 같은 문장을 다시 누르면 닫는다', () => {
    expect(toggleOpen(null, 1)).toBe(1)
    expect(toggleOpen(1, 2)).toBe(2)
    expect(toggleOpen(2, 2)).toBeNull()
  })
})
