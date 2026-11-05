// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import type { TextChangeItem } from '@/shared/api/textChanges'
import type { TextEventDetail, TextEventItem, TextEventList, TextEventQuote, TextEventUnboundChange } from '@/shared/api/textEvents'
import type { TextEventsView } from '../model/textEvents'
import { axeViolations } from '@/test/axe'
import { TextEventsArea, TextEventsSection } from './TextEventsSection'

const detail = vi.hoisted(() => ({ state: { status: 'loading' } as unknown, reload: vi.fn(), calledWith: [] as number[] }))
vi.mock('../hooks/useTextEvents', () => ({
  useTextEventDetail: (_analysisId: number, eventId: number) => {
    detail.calledWith.push(eventId)
    return { state: detail.state, reload: detail.reload }
  },
}))

const analysis = {
  analysisId: 16,
  previous: { reportName: '반기보고서 (2025.06)' },
  current: { reportName: '반기보고서 (2026.06)' },
} as unknown as Analysis

const quote = (changeId: number, purpose: TextEventQuote['purpose'], side: TextEventQuote['side'], text: string): TextEventQuote => ({
  changeId,
  purpose,
  side,
  text,
  evidenceId: `20260814003958#B${changeId}`,
  sectionPath: 'XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 3. 제재 등',
})

function event(overrides: Partial<TextEventItem> = {}): TextEventItem {
  return {
    eventId: 7,
    sortOrder: 1,
    title: '과징금을 새로 부과받았어요',
    kind: '제재',
    fields: ['LITIGATION'],
    changeIds: [101, 102],
    quotes: [quote(101, 'CHANGE', 'PREVIOUS', '이전 보고서의 글'), quote(102, 'CHANGE', 'CURRENT', '이번 보고서의 글')],
    scaleAmount: null,
    scaleAmountText: null,
    currency: null,
    scaleAmountKrw: null,
    scaleEvidenceId: null,
    fxSource: null,
    fxRateDate: null,
    aiGenerated: true,
    ...overrides,
  } as TextEventItem
}

const change = (changeId: number) => ({ changeId }) as TextChangeItem

function show(items: TextEventItem[], droppedEventCount = 0) {
  const onOpenEvidence = vi.fn()
  const renderChanges = vi.fn<(changes: TextChangeItem[], eventId: number) => ReactNode>((changes) => <ul>{changes.map((c) => <li key={c.changeId}>변경 {c.changeId}</li>)}</ul>)
  const view = render(
    <TextEventsSection
      analysis={analysis}
      list={{ droppedEventCount, items } as TextEventList}
      items={items}
      onOpenEvidence={onOpenEvidence}
      renderChanges={renderChanges}
    />,
  )
  return { ...view, onOpenEvidence, renderChanges }
}

const open = () => fireEvent.click(screen.getByRole('button', { name: '펼치기' }))

beforeEach(() => {
  detail.state = { status: 'loading' }
  detail.reload.mockReset()
  detail.calledWith = []
})
afterEach(cleanup)

describe('TextEventsSection', () => {
  const foreign = { scaleAmount: 11_800_000, scaleAmountText: 'USD 11,800,000', currency: 'USD', scaleAmountKrw: 16_300_000_000, scaleEvidenceId: '20260814003958#B1576', fxSource: 'reference_table', fxRateDate: '2025-12-31' } as const

  it('펼치지 않아도 원래 금액, 환산 참고값과 기준, 근거 ID가 따로 보인다', () => {
    show([event(foreign)])

    const card = within(screen.getByRole('article', { name: '과징금을 새로 부과받았어요' }))
    expect(card.getByText('USD 11,800,000')).toBeTruthy()
    expect(card.getByText('약 163억원 (기준: 한국은행 매매기준율 2025-12-31)')).toBeTruthy()
    expect(card.getByText('20260814003958#B1576')).toBeTruthy()
  })

  it('금액이 없는 사건에는 금액 줄이 없다', () => {
    show([event()])

    expect(screen.queryByText('금액')).toBeNull()
    expect(screen.queryByText(/근거 ID/)).toBeNull()
  })

  it('금액의 근거 위치가 없으면 검토 필요로 보인다', () => {
    show([event({ ...foreign, scaleEvidenceId: null })])

    expect(screen.getByText('검토 필요')).toBeTruthy()
  })

  it('사건마다 자기 금액만 보이고 더한 값을 보이지 않는다', () => {
    show([event(foreign), event({ ...foreign, eventId: 8, title: '다른 사건', scaleAmount: 2_000_000, scaleAmountText: 'USD 2,000,000' })])

    expect(screen.getByText('USD 11,800,000')).toBeTruthy()
    expect(screen.getByText('USD 2,000,000')).toBeTruthy()
    expect(screen.queryByText(/13,800,000/)).toBeNull()
  })

  it('카드마다 제목, AI 생성, 사건 종류가 보이고 투자 판단이 아니라는 안내가 있다', () => {
    show([event()])

    const card = within(screen.getByRole('article', { name: '과징금을 새로 부과받았어요' }))
    expect(card.getByText('AI 생성')).toBeTruthy()
    expect(card.getByText('제재')).toBeTruthy()
    expect(screen.getByText(/투자 판단이나 추천이 아니에요/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: '주요 사건 1건' })).toBeTruthy()
  })

  it('보여 줄 사건이 없으면 절이 없다', () => {
    const { container } = show([])

    expect(container.firstChild).toBeNull()
  })

  it('접혀 있을 때는 인용이 없고, 펼치면 이전·이번 인용과 원문 위치가 있다', () => {
    show([event()])
    expect(screen.queryByText('이전 보고서의 글')).toBeNull()

    open()

    expect(screen.getByText('이전 · 반기보고서 (2025.06)')).toBeTruthy()
    expect(screen.getByText('이전 보고서의 글')).toBeTruthy()
    expect(screen.getByText('이번 · 반기보고서 (2026.06)')).toBeTruthy()
    expect(screen.getByText('이번 보고서의 글')).toBeTruthy()
    expect(screen.getAllByText(/3\. 제재 등/)).toHaveLength(2)
  })

  it('인용의 원문 비교를 누르면 그 인용이 나온 변경을 연다', () => {
    const { onOpenEvidence } = show([event()])
    open()

    fireEvent.click(screen.getAllByRole('button', { name: '원문 비교' })[1])

    expect(onOpenEvidence).toHaveBeenCalledWith(102)
  })

  it('한쪽 인용이 없으면 없다고 적는다', () => {
    show([event({ quotes: [quote(102, 'CHANGE', 'CURRENT', '이번 보고서의 글')] })])
    open()

    expect(screen.getByText('이 쪽에서 인용한 글이 없어요.')).toBeTruthy()
  })

  it('공시에 적힌 이유가 없으면 확인된 설명 없음으로 보인다', () => {
    show([event()])
    open()

    expect(screen.getByText('확인된 설명 없음')).toBeTruthy()
  })

  it('공시에 적힌 이유가 있으면 인용을 보인다', () => {
    show([event({ quotes: [quote(101, 'REASON', 'CURRENT', '회계처리기준 위반으로 조치했어요')] })])
    open()

    expect(screen.getByText('회계처리기준 위반으로 조치했어요')).toBeTruthy()
    expect(screen.queryByText('확인된 설명 없음')).toBeNull()
  })

  it('변경 보기를 누르기 전에는 사건 하나를 부르지 않고, 누르면 묶인 변경 목록이 보인다', () => {
    detail.state = { status: 'success', data: { changes: [change(101), change(102)] } as TextEventDetail }
    const { renderChanges } = show([event()])
    open()
    expect(detail.calledWith).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: '변경 보기 2건' }))

    expect(screen.getByText('변경 101')).toBeTruthy()
    expect(screen.getByText('변경 102')).toBeTruthy()
    expect(renderChanges).toHaveBeenCalledWith(expect.anything(), 7)
  })

  it('묶인 변경이 많으면 10건씩 더 보기로 본다', () => {
    const changes = Array.from({ length: 12 }, (_, i) => change(i + 1))
    detail.state = { status: 'success', data: { changes } as TextEventDetail }
    show([event({ changeIds: changes.map((c) => c.changeId) })])
    open()
    fireEvent.click(screen.getByRole('button', { name: '변경 보기 12건' }))
    expect(screen.queryByText('변경 11')).toBeNull()
    expect(screen.getByText('10 / 12건')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /더 보기/ }))

    expect(screen.getByText('변경 12')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /더 보기/ })).toBeNull()
  })

  it('묶인 변경을 받지 못하면 다시 시도할 수 있다', () => {
    detail.state = { status: 'error', error: new Error('실패') }
    show([event()])
    open()
    fireEvent.click(screen.getByRole('button', { name: '변경 보기 2건' }))

    fireEvent.click(screen.getByRole('button', { name: /다시 시도/ }))

    expect(detail.reload).toHaveBeenCalled()
  })

  it('검증에 실패해 뺀 사건이 있으면 알린다', () => {
    show([event()], 1)

    expect(screen.getByText('근거를 확인하지 못한 사건은 보여 주지 않았어요.')).toBeTruthy()
  })

  it('펼친 카드에 접근성 위반이 없다', async () => {
    const { container } = show([event()])
    open()

    expect(await axeViolations(container)).toBe('')
  })
})

describe('TextEventsArea', () => {
  const noFilter = { pinned: false, searched: false, riskOnly: false, type: null, field: null }
  const unbound = (changeId: number, overrides: Partial<TextEventUnboundChange> = {}): TextEventUnboundChange => ({
    changeId,
    changeType: 'MODIFIED',
    field: 'CONTRACT',
    sectionPath: `II. 사업의 내용 > ${changeId}. 주요계약`,
    previousPreview: `이전 글 ${changeId}`,
    currentPreview: `현재 글 ${changeId}`,
    ...overrides,
  })
  const ready = (items: TextEventItem[], unboundChanges: TextEventUnboundChange[]): TextEventsView => ({
    status: 'ready',
    list: { droppedEventCount: 0, items, unboundChanges } as unknown as TextEventList,
  })

  function area(view: TextEventsView, scope = noFilter as Parameters<typeof TextEventsArea>[0]['scope']) {
    const onOpenEvidence = vi.fn()
    const onRetry = vi.fn()
    const result = render(<TextEventsArea analysis={analysis} view={view} scope={scope} onRetry={onRetry} onOpenEvidence={onOpenEvidence} renderChanges={() => null} />)
    return { ...result, onOpenEvidence, onRetry }
  }

  it('만드는 중이면 사건 자리에 진행 표시가 있고 카드는 없다(AC33)', () => {
    area({ status: 'building' })

    expect(screen.getByRole('status').textContent).toContain('주요 사건을 만드는 중이에요')
    expect(screen.queryByRole('article')).toBeNull()
  })

  it('만들지 못했으면 안내가 있고 사건 카드는 없다(AC21)', () => {
    area({ status: 'unavailable', retry: 'none' })

    expect(screen.getByRole('status').textContent).toContain('주요 사건을 만들지 못했어요')
    expect(screen.queryByRole('article')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('다시 시도할 수 있으면 버튼이 있고 누르면 다시 시도한다', () => {
    const { onRetry } = area({ status: 'unavailable', retry: 'available' })

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('다시 시도 한도에 닿으면 버튼 없이 나중에 확인하라고 안내한다', () => {
    area({ status: 'unavailable', retry: 'limited' })

    expect(screen.getByRole('status').textContent).toContain('나중에 다시 확인해 주세요')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('다시 시도 버튼이 있는 안내에 접근성 위반이 없다', async () => {
    const { container } = area({ status: 'unavailable', retry: 'available' })

    expect(await axeViolations(container)).toBe('')
  })

  it('묶은 사건이 없으면 실패가 아니라 없다고 안내한다', () => {
    area({ status: 'empty' })

    expect(screen.getByRole('status').textContent).toContain('주요 사건으로 묶은 변경이 없어요')
  })

  it('꺼 둔 기능이나 옛 분석이면 아무것도 그리지 않는다', () => {
    const { container } = area({ status: 'hidden' })

    expect(container.textContent).toBe('')
  })

  it('고정·검색 등으로 거르면 진행 표시와 안내도 빠진다', () => {
    const { container } = area({ status: 'building' }, { ...noFilter, searched: true })

    expect(container.textContent).toBe('')
  })

  it('묶이지 않은 변경이 AI 생성 표시 없이 원문 그대로 보인다(AC22)', () => {
    area(ready([event()], [unbound(11)]))

    const heading = screen.getByRole('heading', { name: '사건으로 묶이지 않은 주요 변경 1건' })
    const section = within(heading.closest('section') as HTMLElement)
    const card = within(section.getByRole('article'))
    expect(card.getByText('이전 글 11')).toBeTruthy()
    expect(card.getByText('현재 글 11')).toBeTruthy()
    expect(card.getByText('주요 계약')).toBeTruthy()
    expect(section.queryByText('AI 생성')).toBeNull()
  })

  it('사건이 하나도 없어도 묶이지 않은 변경은 보이고 주요 사건 제목은 없다', () => {
    area(ready([], [unbound(11)]))

    expect(screen.getByRole('heading', { name: '사건으로 묶이지 않은 주요 변경 1건' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /^주요 사건/ })).toBeNull()
  })

  it('없는 쪽의 글은 지어내지 않고 없다고 적는다', () => {
    area(ready([], [unbound(11, { changeType: 'ADDED', previousPreview: null })]))

    expect(screen.getByText('이전 보고서에 없던 내용')).toBeTruthy()
  })

  it('원문 비교를 누르면 그 변경의 번호로 연다', () => {
    const { onOpenEvidence } = area(ready([], [unbound(11)]))

    fireEvent.click(screen.getByRole('button', { name: '원문 비교' }))

    expect(onOpenEvidence).toHaveBeenCalledWith(11)
  })

  it('많으면 10건씩 나눠 보여 주고 더 보기로 이어 본다', () => {
    area(ready([], Array.from({ length: 12 }, (_, i) => unbound(i + 1))))

    expect(screen.getAllByRole('article')).toHaveLength(10)
    fireEvent.click(screen.getByRole('button', { name: /더 보기/ }))
    expect(screen.getAllByRole('article')).toHaveLength(12)
  })

  it('분야를 고르면 그 칸의 묶이지 않은 변경만 보인다', () => {
    area(ready([], [unbound(11), unbound(12, { field: 'LITIGATION' })]), { ...noFilter, field: 'LITIGATION' })

    expect(screen.getByRole('heading', { name: '사건으로 묶이지 않은 주요 변경 1건' })).toBeTruthy()
    expect(screen.getByText('현재 글 12')).toBeTruthy()
    expect(screen.queryByText('현재 글 11')).toBeNull()
  })

  it('묶이지 않은 변경에 접근성 위반이 없다', async () => {
    const { container } = area(ready([event()], [unbound(11)]))

    expect(await axeViolations(container)).toBe('')
  })
})
