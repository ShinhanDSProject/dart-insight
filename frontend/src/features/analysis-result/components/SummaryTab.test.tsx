// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import type { Summary, SummaryItem, SummaryLens } from '@/shared/api/summary'
import { axeViolations } from '@/test/axe'
import type { SummaryView } from '../model/summaryLens'
import { SummaryTab } from './SummaryTab'

const labels: Record<SummaryLens, string> = {
  PROFITABILITY: '수익성',
  GROWTH: '성장',
  STABILITY: '재무 안정성',
  CASH_FLOW: '현금흐름',
  SHAREHOLDER: '주주 환원',
  RISK: '위험',
  OTHER: '기타',
}

function item(itemNo: number, lens: SummaryLens, kind: 'FINANCIAL' | 'TEXT', sentence: string): SummaryItem {
  return {
    itemNo,
    kind,
    target: { type: kind, changeId: itemNo, sjDiv: kind === 'FINANCIAL' ? 'IS' : null },
    lens,
    lensLabel: labels[lens],
    factSentence: kind === 'FINANCIAL' ? sentence : null,
    aiText: kind === 'TEXT' ? sentence : null,
    aiGenerated: kind === 'TEXT',
    explanationStatus: kind === 'FINANCIAL' ? 'NOT_FOUND' : null,
    explanationGrade: kind === 'FINANCIAL' ? 'NONE' : null,
    quote: null,
    quoteEvidence: null,
    gradeReason: null,
    evidence: [],
    ai: kind === 'TEXT' ? { model: 'fake-model', promptVersion: 'summary-3', generatedAt: '2026-10-21T14:07:12' } : null,
  }
}

const items = [
  item(1, 'GROWTH', 'FINANCIAL', '매출액이 145조 원에서 152조 원으로 늘었어요(+4.8%).'),
  item(2, 'PROFITABILITY', 'FINANCIAL', '영업이익이 6조 원에서 9조 원으로 늘었어요(+50.0%).'),
  item(3, 'RISK', 'TEXT', '우발부채 문단에 소송 1건이 더해졌어요.'),
]
const counts: Partial<Record<SummaryLens, number>> = { GROWTH: 1, PROFITABILITY: 1, RISK: 1 }

const summary: Summary = {
  analysisId: 42,
  summaryStatus: 'PARTIAL',
  summaryMessage: null,
  textStatus: 'COMPLETED',
  items,
  lensCounts: (Object.keys(labels) as SummaryLens[]).map((lens) => ({ lens, lensLabel: labels[lens], count: counts[lens] ?? 0 })),
  reviewNeededCount: 1,
  reviewNeeded: [
    { itemNo: 4, kind: 'TEXT', target: { type: 'TEXT', changeId: 4, sjDiv: null }, lens: 'RISK', lensLabel: '위험', reason: '원문에 없는 숫자(3)를 썼어요.', blockedRules: [] },
  ],
}

vi.mock('../hooks/useSummary', () => ({ useSummary: () => ({ state: { status: 'success', data: summary }, reload: () => {} }) }))
vi.mock('../hooks/useSummaryAmounts', () => ({ useSummaryAmounts: () => ({ state: { status: 'loading' }, reload: () => {} }) }))
vi.mock('../hooks/useChangeOverview', () => ({
  useChangeOverview: () => ({ financial: { state: { status: 'loading' }, reload: () => {} }, text: { state: { status: 'loading' }, reload: () => {} } }),
}))

const analysis = {
  analysisId: 42,
  previous: { rceptNo: '20250814000001', reportName: '반기보고서 (2025.06)', dartUrl: null },
  current: { rceptNo: '20260814000001', reportName: '반기보고서 (2026.06)', dartUrl: null },
} as unknown as Analysis

const noop = () => {}
/** 핵심 3줄(위)에도 같은 문장이 나오므로 요약 본문 안에서만 찾는다 */
const body = () => within(screen.getByRole('region', { name: '요약·설명' }))

afterEach(cleanup)

function draw(lens: SummaryLens | null, view: SummaryView) {
  const onChangeLens = vi.fn()
  const result = render(
    <MemoryRouter>
      <main>
        <SummaryTab
          analysis={analysis}
          onOpenFinancial={noop}
          onOpenText={noop}
          onOpenSource={noop}
          onOpenChangedAccounts={noop}
          onOpenTextList={noop}
          onOpenTextSection={noop}
          suggestions={{ status: 'success', data: [] }}
          onAsk={noop}
          onOpenAsk={noop}
          asking={false}
          lens={lens}
          view={view}
          onChangeLens={onChangeLens}
        />
      </main>
    </MemoryRouter>,
  )
  return { ...result, onChangeLens }
}

describe('요약 투자자 관점(FS-64)', () => {
  it('기본은 관점별로 묶고 관점 제목 옆에 흔히 묻는 질문을 보이며, 0건 관점은 거르기에 없다(AC1)', () => {
    draw(null, 'lens')
    const filters = screen.getByRole('group', { name: '투자자 관점' })
    expect(within(filters).getAllByRole('button').map((b) => b.textContent)).toEqual(['전체 3', '수익성 1', '성장 1', '위험 1'])
    expect(screen.getByRole('heading', { name: '수익성 1건' })).toBeTruthy()
    expect(screen.getByText('매출이 늘 때 이익도 따라 늘었을까요?')).toBeTruthy()
    expect(screen.getByText('회사가 밝힌 위험이 바뀌었을까요?')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '주요 재무 수치 변화' })).toBeNull()
  })

  it('관점을 고르면 그 관점의 줄과 검토 필요만 남고, 고르기는 주소 값으로 넘긴다(AC2)', () => {
    const { onChangeLens } = draw('RISK', 'lens')
    expect(body().getByText('우발부채 문단에 소송 1건이 더해졌어요.')).toBeTruthy()
    expect(body().queryByText(/매출액이/)).toBeNull()
    expect(body().getByRole('heading', { name: '검토 필요 1건' })).toBeTruthy()
    fireEvent.click(body().getByRole('button', { name: /^성장/ }))
    expect(onChangeLens).toHaveBeenCalledWith({ lens: 'GROWTH' })
    fireEvent.click(screen.getByRole('button', { name: '목록으로 보기' }))
    expect(onChangeLens).toHaveBeenCalledWith({ view: 'list' })
  })

  it('목록 보기는 재무·문장 두 묶음으로 보이고 관점 거르기를 그대로 쓴다', () => {
    draw('GROWTH', 'list')
    expect(screen.getByRole('heading', { name: '주요 재무 수치 변화' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '주요 문장·내용 변화' })).toBeNull()
    expect(screen.queryByRole('heading', { name: '검토 필요 1건' })).toBeNull()
  })

  it('주소에 남은 관점이 이 요약에 없으면 전체를 보인다', () => {
    draw('CASH_FLOW', 'lens')
    expect(body().getByRole('button', { name: /^전체/ }).getAttribute('aria-pressed')).toBe('true')
    expect(body().getByText(/매출액이/)).toBeTruthy()
  })

  it('관점별·목록 보기 모두 접근성 위반이 없다(axe)', async () => {
    const lens = draw(null, 'lens')
    expect(await axeViolations(lens.container)).toBe('')
    cleanup()
    const list = draw('RISK', 'list')
    expect(await axeViolations(list.container)).toBe('')
  })
})
