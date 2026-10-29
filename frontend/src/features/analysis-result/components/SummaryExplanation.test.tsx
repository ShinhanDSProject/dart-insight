// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import type { SummaryEvidence, SummaryItem } from '@/shared/api/summary'
import { axeViolations } from '@/test/axe'
import { SummaryExplanation } from './SummaryExplanation'

afterEach(cleanup)

const CUR = '20250814000123'

const analysis = {
  analysisId: 16,
  current: { rceptNo: CUR, reportName: '반기보고서 (2025.06)', dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${CUR}` },
  previous: { rceptNo: '20250314000100', reportName: '사업보고서 (2024.12)', dartUrl: null },
} as unknown as Analysis

const at812: SummaryEvidence = { evidenceId: `${CUR}#B812`, side: 'current', rceptNo: CUR, sectionNo: 41, blockNo: 812 }

function financial(fields: Partial<SummaryItem>): SummaryItem {
  return {
    itemNo: 1,
    kind: 'FINANCIAL',
    target: { type: 'FINANCIAL', changeId: 101, sjDiv: 'IS' },
    lens: 'GROWTH',
    lensLabel: '성장',
    factSentence: '매출액이 145조 원에서 152조 원으로 늘었어요(+4.8%).',
    aiText: null,
    aiGenerated: false,
    explanationStatus: 'NOT_FOUND',
    explanationGrade: 'NONE',
    quote: null,
    quoteEvidence: null,
    gradeReason: null,
    evidence: [],
    ai: null,
    ...fields,
  }
}

function explained(grade: 'STATED' | 'RELATED', gradeReason: string | null = null): SummaryItem {
  return financial({
    aiText: '회사는 메모리 수요 회복으로 매출이 늘었다고 적었어요.',
    aiGenerated: true,
    explanationStatus: 'FOUND',
    explanationGrade: grade,
    quote: '매출액은 메모리 수요 회복으로 증가하였습니다',
    quoteEvidence: at812,
    gradeReason,
    evidence: [at812],
    ai: { model: 'fake-model', promptVersion: 'summary-3', generatedAt: '2026-10-21T14:07:12' },
  })
}

function draw(item: SummaryItem) {
  const onOpenSource = vi.fn()
  const { container } = render(<SummaryExplanation item={item} analysis={analysis} onOpenSource={onOpenSource} />)
  return { container, onOpenSource }
}

describe('SummaryExplanation', () => {
  it("회사가 밝힌 설명은 'AI 생성' 설명과 공시 원문 인용을 함께 보인다", async () => {
    const { container } = draw(explained('STATED'))

    expect(screen.getByText('회사가 공시에서 밝힌 설명')).toBeTruthy()
    expect(screen.getByText('AI 생성')).toBeTruthy()
    expect(screen.getByText('공시 원문 인용')).toBeTruthy()
    expect(screen.getByText('매출액은 메모리 수요 회복으로 증가하였습니다')).toBeTruthy()
    expect(screen.queryByText(/직접 밝힌 설명은 아니에요/)).toBeNull()
    expect(await axeViolations(container)).toBe('')
  })

  it('관련 공시 내용은 회사가 직접 밝힌 설명이 아니라고 알린다', async () => {
    const { container } = draw(explained('RELATED', "인용문에 계정 이름이 없어 '관련 내용'으로 낮췄어요."))

    expect(screen.getByText('관련 공시 내용')).toBeTruthy()
    expect(screen.getByText(/회사가 직접 밝힌 설명은 아니에요/)).toBeTruthy()
    expect(screen.queryByText('회사가 공시에서 밝힌 설명')).toBeNull()
    expect(screen.queryByText(/확인된 설명 없음/)).toBeNull()
    expect(await axeViolations(container)).toBe('')
  })

  it('인용 위치를 누르면 원문 확인 탭의 그 블록을 연다', () => {
    const { onOpenSource } = draw(explained('STATED'))

    fireEvent.click(screen.getByRole('button', { name: '인용 위치: 반기보고서 (2025.06) 원문 위치 보기' }))

    expect(onOpenSource).toHaveBeenCalledWith({ side: 'current', section: 41, block: 812 })
  })

  it('설명 없음은 후보가 없던 경우와 코드가 인용을 확인하지 못한 경우를 다르게 보인다', () => {
    draw(financial({}))
    expect(screen.getByText(/이유를 적은 문단을 찾지 못했어요/)).toBeTruthy()
    cleanup()

    draw(financial({ gradeReason: '인용문이 후보 원문에 그대로 없어 설명으로 쓰지 않았어요.' }))
    expect(screen.getByText(/관련 문단은 있지만 인용을 원문에서 확인하지 못했어요/)).toBeTruthy()
    expect(screen.queryByText('공시 원문 인용')).toBeNull()
  })

  it("검토 필요는 등급·인용 없이 '검토 필요'로 보인다", () => {
    draw(financial({ explanationStatus: 'REVIEW_NEEDED', explanationGrade: null }))

    expect(screen.getByText(/^검토 필요/)).toBeTruthy()
    expect(screen.queryByText(/확인된 설명 없음/)).toBeNull()
  })

  it("템플릿 요약은 'AI 생성' 없이 코드가 확인한 인용을 회사 설명으로 보이고 인용 위치를 연다", async () => {
    const { container, onOpenSource } = draw(
      financial({ explanationStatus: 'TEMPLATE', explanationGrade: null, quote: '매출액은 메모리 수요 회복으로 증가하였습니다', quoteEvidence: at812 }),
    )

    expect(screen.getByText('회사 설명 · 공시 원문 인용')).toBeTruthy()
    expect(screen.getByText('매출액은 메모리 수요 회복으로 증가하였습니다')).toBeTruthy()
    expect(screen.getByText(/^검토 필요 · AI 설명이 검증을 통과하지 못해/)).toBeTruthy()
    expect(screen.queryByText('AI 생성')).toBeNull()
    expect(screen.queryByText('회사가 공시에서 밝힌 설명')).toBeNull()
    expect(await axeViolations(container)).toBe('')

    fireEvent.click(screen.getByRole('button', { name: '인용 위치: 반기보고서 (2025.06) 원문 위치 보기' }))
    expect(onOpenSource).toHaveBeenCalledWith({ side: 'current', section: 41, block: 812 })
  })

  it("템플릿 요약에 확인된 인용이 없으면 '회사 설명: 확인된 설명 없음'으로 보인다", () => {
    draw(financial({ explanationStatus: 'TEMPLATE', explanationGrade: null }))

    expect(screen.getByText('회사 설명: 확인된 설명 없음')).toBeTruthy()
    expect(screen.queryByText('회사 설명 · 공시 원문 인용')).toBeNull()
    expect(screen.queryByText('AI 생성')).toBeNull()
  })

  it('등급 기능 전에 만든 설명은 등급 제목과 인용 없이 설명만 보인다', () => {
    draw(financial({ aiText: '회사는 수요 회복을 적었어요.', aiGenerated: true, explanationStatus: 'FOUND', explanationGrade: null }))

    expect(screen.getByText('회사는 수요 회복을 적었어요.')).toBeTruthy()
    expect(screen.queryByText('회사가 공시에서 밝힌 설명')).toBeNull()
    expect(screen.queryByText('관련 공시 내용')).toBeNull()
    expect(screen.queryByText('공시 원문 인용')).toBeNull()
  })
})
