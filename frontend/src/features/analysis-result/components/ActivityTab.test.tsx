// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import type { ActivityItem, PeriodActivities } from '@/shared/api/activities'
import type { LoadState } from '@/shared/hooks/asyncState'
import { axeViolations } from '@/test/axe'
import { ActivityTab } from './ActivityTab'

const data = vi.hoisted(() => ({ state: { status: 'loading' } as LoadState<PeriodActivities> }))
vi.mock('../hooks/usePeriodActivities', () => ({
  usePeriodActivities: () => ({ state: data.state, reload: () => {} }),
}))
vi.mock('./KeyNumbers', () => ({ KeyNumbers: () => <p>핵심 숫자 자리</p> }))

afterEach(cleanup)

const analysis = {
  analysisId: 7,
  previous: { reportName: '사업보고서 (2024.12)' },
  current: { reportName: '사업보고서 (2025.12)' },
} as Analysis

const evidence = (blockNo: number) => ({
  evidenceId: `20260310000001#B${blockNo}`,
  rceptNo: '20260310000001',
  blockNo,
  side: 'CURRENT' as const,
  sectionPath: 'II. 사업의 내용',
  changeId: 41,
})

const contract: ActivityItem = {
  no: 1,
  area: 'BUSINESS',
  audiences: ['INVESTOR', 'PARTNER'],
  title: '북미 고객사와 장기 공급 계약',
  summary: '새 고객사에 부품을 공급하기로 했어요.',
  facts: [{ quote: '북미 고객사와 장기 공급 계약을 체결하였습니다.', evidence: evidence(11) }],
  signal: 'POSITIVE',
  holdReason: null,
  signalKind: 'MAJOR_CONTRACT',
  signalKindName: '주요 계약',
  signalChange: 'NEW_SUPPLY',
  signalChangeName: '새 공급 계약',
  impacts: [
    { kind: 'CHECK', tone: null, text: '다음 보고서에서 계약 이행 상황을 확인해 보세요.', premises: [] },
    {
      kind: 'OUTLOOK',
      tone: 'GOOD',
      text: '계약이 예정대로 이행되면 매출처가 넓어질 수 있어요.',
      premises: [{ quote: '북미 고객사와 장기 공급 계약을 체결하였습니다.', evidence: evidence(11) }],
    },
  ],
  changeIds: [41],
}

const lawsuit: ActivityItem = {
  ...contract,
  no: 2,
  area: 'RISK',
  audiences: ['CAREER'],
  title: '특허 소송 피소',
  signal: 'HOLD',
  holdReason: 'NO_CRITERIA',
  impacts: [],
  changeIds: [],
}

function generated(items: ActivityItem[]): PeriodActivities {
  return {
    analysisId: 7,
    status: 'GENERATED',
    reason: null,
    message: null,
    overview: { text: '이 기간에 새 공급 계약과 소송이 있었어요.', evidence: [evidence(11)] },
    items,
    timeline: [],
    droppedCount: 1,
    candidateCount: 20,
    aiGenerated: true,
    ai: { model: 'fake', promptVersion: 'period-activity-2', generatedAt: '2026-11-10T09:00:00+09:00' },
  }
}

function renderTab(state: LoadState<PeriodActivities>) {
  data.state = state
  const onOpenText = vi.fn()
  const onOpenAll = vi.fn()
  const view = render(<ActivityTab analysis={analysis} onOpenText={onOpenText} onOpenFinancial={vi.fn()} onOpenAll={onOpenAll} />)
  return { onOpenText, onOpenAll, ...view }
}

const disclosure = {
  evidenceId: 'D20260319801333',
  rceptNo: '20260319801333',
  blockNo: null,
  side: 'DISCLOSURE' as const,
  sectionPath: '기업가치제고계획(자율공시)',
  changeId: null,
}

const financial = {
  evidenceId: 'F9',
  rceptNo: '20260310000001',
  blockNo: null,
  side: 'FINANCIAL' as const,
  sectionPath: '연결 손익계산서 > 매출액',
  changeId: null,
}

/** 접혀 있는 타임라인을 편다(#907) */
function openTimeline(container: HTMLElement) {
  fireEvent.click(container.querySelector<HTMLElement>('summary.activity__timeline-summary')!)
}

describe('한 문단 요약과 이 기간 타임라인(ADR-0068)', () => {
  const withTimeline: PeriodActivities = {
    ...generated([contract]),
    overview: { text: '이 기간에 매출이 늘었어요.', evidence: [financial, evidence(11)] },
    timeline: [
      { date: '2025-09-23', text: '자회사를 인수했어요.', evidence: [evidence(11)] },
      { date: '2026-03-19', text: '기업가치 제고 계획을 공시했어요.', evidence: [disclosure] },
    ],
  }

  it('제목과 근거가 있는 요약, 날짜순 타임라인을 보인다', async () => {
    const { container } = renderTab({ status: 'success', data: withTimeline })

    const overview = within(screen.getByRole('region', { name: '한 문단 요약' }))
    expect(overview.getByText('이 기간에 매출이 늘었어요.')).toBeTruthy()
    expect(overview.getByText(/연결 손익계산서 > 매출액/)).toBeTruthy()
    openTimeline(container)
    const rows = within(screen.getByRole('region', { name: '이 기간 타임라인' })).getAllByRole('listitem')
    expect(rows.map((row) => row.querySelector('time')?.textContent)).toEqual(['2025.09.23', '2026.03.19'])
    expect(await axeViolations(container)).toBe('')
  })

  it('타임라인은 처음엔 접혀 있고 제목 줄에 건수와 기간을 보이며, 누르면 통째로 펴고 다시 누르면 접는다', async () => {
    const { container } = renderTab({ status: 'success', data: withTimeline })
    const details = container.querySelector<HTMLDetailsElement>('details.activity__timeline-details')!
    const summary = details.querySelector<HTMLElement>('summary')!

    expect(details.open).toBe(false)
    expect(summary.textContent).toContain('이 기간 타임라인')
    expect(summary.textContent).toContain('2건 · 2025.09.23 ~ 2026.03.19')
    expect(await axeViolations(container)).toBe('')

    fireEvent.click(summary)
    expect(details.open).toBe(true)
    expect(details.querySelectorAll('li.activity__timeline-row')).toHaveLength(2)

    fireEvent.click(summary)
    expect(details.open).toBe(false)
  })

  it('공시 근거는 DART 원문을 새 창으로 열고 보고서 근거는 원문 탭의 바뀐 곳으로 간다', () => {
    const { container, onOpenText } = renderTab({ status: 'success', data: withTimeline })
    openTimeline(container)
    const timeline = within(screen.getByRole('region', { name: '이 기간 타임라인' }))

    const link = timeline.getByRole('link', { name: '기업가치제고계획(자율공시)' })
    expect(link.getAttribute('href')).toContain('rcpNo=20260319801333')
    expect(link.getAttribute('target')).toBe('_blank')
    fireEvent.click(timeline.getByRole('button', { name: /II\. 사업의 내용/ }))
    expect(onOpenText).toHaveBeenCalledWith(41)
  })

  it('요약이 없으면 자리를 비우지 않고 검토 필요를 보인다', async () => {
    const { container } = renderTab({ status: 'success', data: { ...withTimeline, overview: null } })

    const missing = within(screen.getByRole('region', { name: '한 문단 요약' }))
    expect(missing.getByText('검토 필요')).toBeTruthy()
    expect(screen.queryByText('이 기간에 매출이 늘었어요.')).toBeNull()
    expect(await axeViolations(container)).toBe('')
  })

  it('타임라인이 비면 제목도 보이지 않는다', () => {
    renderTab({ status: 'success', data: generated([contract]) })

    expect(screen.queryByRole('region', { name: '이 기간 타임라인' })).toBeNull()
  })
})

describe('공시 분석 탭(ADR-0067)', () => {
  it('AI 생성 요약, 숫자, 활동 카드와 투자 판단이 아니라는 안내를 보인다', async () => {
    const { container } = renderTab({ status: 'success', data: generated([contract, lawsuit]) })

    expect(screen.getByRole('region', { name: '공시 분석' })).toBeTruthy()
    expect(screen.getByText('AI 생성')).toBeTruthy()
    expect(screen.getByText('핵심 숫자 자리')).toBeTruthy()
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(screen.getByText(/투자 판단이나 추천이 아니에요/)).toBeTruthy()
    expect(screen.getByText(/1건은 보여 주지 않았어요/)).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })

  it('카드에 신호, 사실 근거, 회사가 밝힌 것 → AI 전망 → 확인할 점 순서의 영향을 보인다', () => {
    renderTab({ status: 'success', data: generated([contract]) })
    const card = within(screen.getByRole('article'))

    expect(card.getByText('긍정 신호')).toBeTruthy()
    expect(card.getAllByText(/근거 20260310000001#B11/).length).toBeGreaterThan(0)
    const impacts = card.getAllByRole('listitem').filter((li) => li.className.startsWith('activity-impact'))
    expect(impacts.map((li) => li.className)).toEqual(['activity-impact activity-impact--outlook', 'activity-impact activity-impact--check'])
    expect(card.getByText('AI 전망 · 공시 사실 아님')).toBeTruthy()
    expect(card.getByText('좋은 면')).toBeTruthy()
  })

  it('관점 칩으로 카드를 거르고, 영향이 없는 카드는 확인된 영향 없음으로 보인다', () => {
    renderTab({ status: 'success', data: generated([contract, lawsuit]) })

    fireEvent.click(screen.getByRole('button', { name: /사업 방향/ }))
    const card = within(screen.getByRole('article'))
    expect(card.getByText('특허 소송 피소')).toBeTruthy()
    expect(card.getByText('확인된 영향 없음')).toBeTruthy()
    expect(card.getByText(/판단 기준표에 없는 사건/)).toBeTruthy()
  })

  it('원문 비교 버튼은 원문 탭의 바뀐 곳에서 그 문장 변경을 연다', () => {
    const { onOpenText, onOpenAll } = renderTab({ status: 'success', data: generated([contract]) })

    fireEvent.click(screen.getByRole('button', { name: '바뀐 곳에서 원문 비교 보기' }))
    expect(onOpenText).toHaveBeenCalledWith(41)
    fireEvent.click(screen.getByRole('button', { name: '바뀐 곳' }))
    expect(onOpenAll).toHaveBeenCalled()
  })

  it('검토 필요·비교 없음·빈 결과는 카드 대신 안내를 보인다', () => {
    renderTab({ status: 'success', data: { ...generated([]), status: 'REVIEW_NEEDED', overview: null } })
    expect(screen.getByText('검토 필요')).toBeTruthy()
    cleanup()

    renderTab({ status: 'success', data: { ...generated([]), status: 'NOT_AVAILABLE', overview: null, reason: 'TEXT_NOT_COMPARED' } })
    expect(screen.getByText('확인된 설명 없음')).toBeTruthy()
    cleanup()

    renderTab({ status: 'success', data: { ...generated([]), status: 'EMPTY', overview: null } })
    expect(screen.getByText('두 보고서 사이에 따로 짚을 만한 활동을 찾지 못했어요')).toBeTruthy()
    expect(screen.queryAllByRole('article')).toHaveLength(0)
  })
})
