// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import type { TextChangeItem } from '@/shared/api/textChanges'
import type {
  SignalTable,
  TextEventDetail,
  TextEventItem,
  TextEventList,
  TextEventQuote,
  TextEventSentence,
  TextEventSentenceItem,
  TextEventUnboundChange,
} from '@/shared/api/textEvents'
import type { TextEventsView } from '../model/textEvents'
import { axeViolations } from '@/test/axe'
import { TextEventsArea, TextEventsSection } from './TextEventsSection'

const detail = vi.hoisted(() => ({ state: { status: 'loading' } as unknown, reload: vi.fn(), calledWith: [] as number[] }))
const signalTable = vi.hoisted(() => ({ state: { status: 'loading' } as unknown, reload: vi.fn() }))
vi.mock('../hooks/useTextEvents', () => ({
  useTextEventDetail: (_analysisId: number, eventId: number) => {
    detail.calledWith.push(eventId)
    return { state: detail.state, reload: detail.reload }
  },
  useSignalTable: () => ({ state: signalTable.state, reload: signalTable.reload }),
}))

const TABLE = {
  version: 'signal-table-2',
  signalNotice: '공시상 신호이며 투자 판단이 아니에요.',
  kinds: [
    {
      code: 'SANCTION',
      name: '제재',
      front: false,
      changes: [
        { code: 'OCCURRED', name: '새로 발생', signal: 'CAUTION', explicitOnly: false, general: null },
        { code: 'CANCELLED', name: '취소', signal: 'POSITIVE', explicitOnly: true, general: null },
      ],
      generalSides: null,
    },
  ],
  glossary: [],
} as SignalTable

const EVIDENCE_PATH = 'XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 3. 제재 등'
const sentenceItem = (type: TextEventSentenceItem['type'], text: string, evidenceId = '20260814003958#B102'): TextEventSentenceItem => ({
  type,
  text,
  evidence: type === 'GENERAL' ? [] : [{ evidenceId, sectionPath: EVIDENCE_PATH }],
})
const sentence = (status: TextEventSentence['status'], items: TextEventSentenceItem[]): TextEventSentence => ({
  status,
  failReason: status === 'GENERATED' ? null : 'INVALID_OUTPUT',
  aiGenerated: status === 'GENERATED',
  items,
  model: null,
  promptVersion: null,
  generatedAt: null,
})

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
    kindCode: 'SANCTION',
    changeCode: 'OCCURRED',
    changeName: '새로 발생',
    signal: 'CAUTION',
    holdReason: null,
    rowCounts: null,
    meaning: null,
    signalReason: null,
    glossary: [],
    facts: [],
    scaleRatio: null,
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

const open = () => fireEvent.click(screen.getByRole('button', { name: /펼치기$/ }))

beforeEach(() => {
  detail.state = { status: 'loading' }
  detail.reload.mockReset()
  detail.calledWith = []
  signalTable.state = { status: 'success', data: TABLE }
  signalTable.reload.mockReset()
})
afterEach(cleanup)

describe('TextEventsSection', () => {
  const foreign = { scaleAmount: 11_800_000, scaleAmountText: 'USD 11,800,000', currency: 'USD', scaleAmountKrw: 16_300_000_000, scaleEvidenceId: '20260814003958#B1576', fxSource: 'reference_table', fxRateDate: '2025-12-31' } as const

  it('사건 한 줄에는 금액을 보이고, 펼치면 원래 금액, 환산 참고값과 기준, 근거 ID가 따로 보인다(3.58)', () => {
    show([event(foreign)])

    const card = within(screen.getByRole('article', { name: '과징금을 새로 부과받았어요' }))
    expect(card.getByText('제재 · USD 11,800,000 · AI 생성')).toBeTruthy()
    expect(card.queryByText('20260814003958#B1576')).toBeNull()
    fireEvent.click(card.getByRole('button', { name: /펼치기$/ }))
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
    fireEvent.click(screen.getByRole('button', { name: /펼치기$/ }))

    expect(screen.getByText('검토 필요').className).toContain('attention')
  })

  it('사건마다 자기 금액만 보이고 더한 값을 보이지 않는다', () => {
    show([event(foreign), event({ ...foreign, eventId: 8, title: '다른 사건', scaleAmount: 2_000_000, scaleAmountText: 'USD 2,000,000' })])

    expect(screen.getByText(/USD 11,800,000/)).toBeTruthy()
    expect(screen.getByText(/USD 2,000,000/)).toBeTruthy()
    expect(screen.queryByText(/13,800,000/)).toBeNull()
  })

  it('사건 한 줄에 신호, 제목, 사건 종류와 AI 생성이 보이고 투자 판단이 아니라는 안내가 있다(3.58)', () => {
    show([event()])

    const card = within(screen.getByRole('article', { name: '과징금을 새로 부과받았어요' }))
    expect(card.getByText('제재 · AI 생성')).toBeTruthy()
    expect(card.getByRole('heading', { name: '과징금을 새로 부과받았어요' })).toBeTruthy()
    expect(screen.getByText(/투자 판단이나 추천이 아니에요/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: '주요 사건 1건' })).toBeTruthy()
  })

  it('사건은 처음 3건만 보이고 더 보기로 나머지를 연다(3.58 AC18)', () => {
    show([1, 2, 3, 4, 5].map((n) => event({ eventId: n, title: `사건 ${n}` })))

    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.getByRole('heading', { name: '주요 사건 5건' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '사건 2건 더 보기' }))
    expect(screen.getAllByRole('article')).toHaveLength(5)
    expect(screen.queryByRole('button', { name: /더 보기/ })).toBeNull()
  })

  it("펼치기 버튼의 이름에 사건 제목이 들어간다", () => {
    show([event()])

    const button = screen.getByRole('button', { name: '과징금을 새로 부과받았어요 펼치기' })
    fireEvent.click(button)
    expect(button.getAttribute('aria-label')).toBe('과징금을 새로 부과받았어요 접기')
  })

  it('더 보기를 연 뒤 신호를 바꾸면 거른 사건도 처음 3건부터 보인다', () => {
    show([1, 2, 3, 4, 5].map((n) => event({ eventId: n, title: `사건 ${n}`, signal: 'HOLD' })))
    fireEvent.click(screen.getByRole('button', { name: '사건 2건 더 보기' }))
    expect(screen.getAllByRole('article')).toHaveLength(5)

    fireEvent.click(screen.getByRole('button', { name: /^보류/ }))
    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.getByRole('button', { name: '사건 2건 더 보기' })).toBeTruthy()
  })

  it('사건이 3건 이하면 더 보기가 없다', () => {
    show([1, 2, 3].map((n) => event({ eventId: n, title: `사건 ${n}` })))

    expect(screen.getAllByRole('article')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: /더 보기/ })).toBeNull()
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

describe('TextEventsSection 신호와 사건 문장', () => {
  const part = (title: string) => within(screen.getByRole('heading', { name: new RegExp(`^${title}`) }).closest('section') as HTMLElement)
  const generated = {
    meaning: sentence('GENERATED', [sentenceItem('FACT', '지난 보고서에 없던 과징금이 새로 적혔어요.'), sentenceItem('ABSENT', '손익 영향은 이 문단에 적혀 있지 않아요.', '20260814003958#B103')]),
    signalReason: sentence('GENERATED', [sentenceItem('REASON', '당국이 회계처리를 위반으로 판단했어요.'), sentenceItem('REASON', '대표이사에게도 과징금이 부과됐어요.')]),
  }

  it('접힌 카드에도 신호가 글자로 보인다(AC9)', () => {
    show([event(), event({ eventId: 8, title: '보류 사건', signal: 'HOLD', holdReason: 'NO_CRITERIA' })])

    expect(within(screen.getByRole('article', { name: '과징금을 새로 부과받았어요' })).getByText('주의 신호')).toBeTruthy()
    expect(within(screen.getByRole('article', { name: '보류 사건' })).getByText('보류')).toBeTruthy()
  })

  it('사건 종류가 기준표 목록에 없으면 종류 배지 없이 보류로 보인다(AC9)', () => {
    show([event({ kind: '그 밖의 사건', kindCode: 'OTHER', changeCode: 'OTHER', changeName: null, signal: 'HOLD', holdReason: 'NO_CRITERIA' })])

    const card = within(screen.getByRole('article', { name: '과징금을 새로 부과받았어요' }))
    expect(card.getByText('보류')).toBeTruthy()
    expect(card.queryByText('그 밖의 사건')).toBeNull()
  })

  it('기준표를 받으면 기준표의 안내가 사건 절에 보인다', () => {
    show([event()])

    // 3.55: 사건 안내와 신호 안내를 한 줄로 합쳤다
    expect(screen.getByText(/공시상 신호이며 투자 판단이 아니에요\./)).toBeTruthy()
  })

  it('기준표를 받지 못해도 투자 판단이나 추천이 아니라는 안내는 남는다(R15)', () => {
    signalTable.state = { status: 'error', error: new Error('실패') }
    show([event()])

    expect(screen.getByText(/투자 판단이나 추천이 아니에요/)).toBeTruthy()
  })

  it('공시의 의미에 AI 생성 표시와 문장별 원문 위치가 있고, 없음 문장은 확인한 범위로 보인다(AC15)', () => {
    show([event(generated)])
    open()

    const meaning = part('공시의 의미')
    expect(meaning.getByText('AI 생성')).toBeTruthy()
    expect(meaning.getByText('지난 보고서에 없던 과징금이 새로 적혔어요.')).toBeTruthy()
    expect(meaning.getByText('손익 영향은 이 문단에 적혀 있지 않아요.')).toBeTruthy()
    expect(meaning.getAllByText(/3\. 제재 등/)).toHaveLength(2)
    expect(meaning.getByText(/확인한 범위/)).toBeTruthy()
  })

  it('근거가 인용과 같은 블록이면 그 변경의 원문 비교를 연다', () => {
    const { onOpenEvidence } = show([event(generated)])
    open()

    fireEvent.click(part('공시의 의미').getByRole('button', { name: /원문 비교/ }))

    expect(onOpenEvidence).toHaveBeenCalledWith(102)
  })

  it('공시의 의미가 실패하면 AI 문장 없이 용어 풀이만 보인다(AC16)', () => {
    const glossary = [{ term: '약식명령', meaning: '정식 재판 없이 벌금 등을 정하는 절차예요.', source: '법령' }]
    show([event({ meaning: sentence('FAILED', []), glossary })])
    open()

    expect(screen.queryByRole('heading', { name: /^공시의 의미/ })).toBeNull()
    const terms = part('용어 풀이')
    expect(terms.getByText('약식명령')).toBeTruthy()
    expect(terms.getByText('정식 재판 없이 벌금 등을 정하는 절차예요.')).toBeTruthy()
    expect(terms.queryByText('AI 생성')).toBeNull()
  })

  it('신호 이유에 판정 줄과 근거, 근거별 원문 위치가 있다(AC17)', () => {
    show([event({ ...generated, scaleRatio: 0.000_7 })])
    open()

    const reason = part('신호 이유')
    expect(reason.getByText('AI 생성')).toBeTruthy()
    expect(reason.getByText('제재 · 새로 발생 · 자본총계의 약 0.07%')).toBeTruthy()
    expect(reason.getByText('당국이 회계처리를 위반으로 판단했어요.')).toBeTruthy()
    expect(reason.getByText('대표이사에게도 과징금이 부과됐어요.')).toBeTruthy()
    expect(reason.getAllByText(/3\. 제재 등/)).toHaveLength(2)
    expect(reason.queryByText('일반적인 설명이에요.')).toBeNull()
  })

  it('기준 보기를 누르면 기준표가 열리고 이 사건의 줄이 표시된다(AC17)', () => {
    show([event(generated)])
    open()

    fireEvent.click(screen.getByRole('button', { name: '기준 보기' }))

    const dialog = within(screen.getByRole('dialog', { name: '신호 기준표' }))
    expect(dialog.getByText('공시상 신호이며 투자 판단이 아니에요.')).toBeTruthy()
    const rows = dialog.getAllByRole('row').slice(1)
    expect(rows.map((row) => row.textContent)).toEqual(['제재새로 발생주의 신호이 사건', '제재취소긍정 신호'])
    fireEvent.click(dialog.getByRole('button', { name: '닫기' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('기준표를 받지 못하면 대화상자에서 다시 시도할 수 있다', () => {
    signalTable.state = { status: 'error', error: new Error('실패') }
    show([event(generated)])
    open()
    fireEvent.click(screen.getByRole('button', { name: '기준 보기' }))

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '다시 시도' }))

    expect(signalTable.reload).toHaveBeenCalled()
  })

  it('기준이 없거나 근거를 확인하지 못한 보류는 사유 문구가 보인다(AC14)', () => {
    show([event({ title: '기준 없음', signal: 'HOLD', holdReason: 'NO_CRITERIA' }), event({ eventId: 8, title: '근거 없음', signal: 'HOLD', holdReason: 'EVIDENCE_NOT_CONFIRMED' })])
    screen.getAllByRole('button', { name: /펼치기$/ }).forEach((button) => fireEvent.click(button))

    expect(within(screen.getByRole('article', { name: '기준 없음' })).getByText('판단 기준이 아직 없는 사건이에요.')).toBeTruthy()
    expect(within(screen.getByRole('article', { name: '근거 없음' })).getByText('근거를 확인하지 못했어요.')).toBeTruthy()
  })

  it('좋은 면과 나쁜 면이 함께인 보류는 좋은 면·나쁜 면이 근거 위치와 함께 보인다(AC18)', () => {
    show([event({ signal: 'HOLD', holdReason: 'MIXED_SIDES', signalReason: sentence('GENERATED', [sentenceItem('GOOD', '자금이 들어와요.'), sentenceItem('BAD', '지분 비율이 줄 수 있어요.')]) })])
    open()

    const reason = part('신호 이유')
    expect(reason.getByText('좋은 면과 나쁜 면이 함께 있어요.')).toBeTruthy()
    expect(reason.getByText('좋은 면')).toBeTruthy()
    expect(reason.getByText('나쁜 면')).toBeTruthy()
    expect(reason.getAllByText(/3\. 제재 등/)).toHaveLength(2)
  })

  it('섞인 소송은 좋은 면·나쁜 면 없이 판단하지 않은 이유가 보인다(AC19)', () => {
    show([event({ kind: '소송', changeName: '진행', signal: 'HOLD', holdReason: 'MIXED_LITIGATION', rowCounts: { changed: 2, added: 3, missing: 11 }, ...generated, signalReason: sentence('GENERATED', [sentenceItem('WHY_HOLD', '유불리는 사건마다 달라요.')]) })])
    open()

    const reason = part('신호 이유')
    expect(reason.getByText('여러 소송의 진행 상황이 섞여 있어요.')).toBeTruthy()
    expect(reason.getByText('유불리는 사건마다 달라요.')).toBeTruthy()
    expect(reason.queryByText('좋은 면')).toBeNull()
    expect(screen.getByRole('heading', { name: /^공시의 의미/ })).toBeTruthy()
  })

  it('신호 이유가 실패하면 일반 문구와 일반적인 설명이라는 표시가 AI 생성 표시 없이 보인다(AC20)', () => {
    show([event({ signalReason: sentence('FALLBACK', [sentenceItem('GENERAL', '제재를 받은 것이라 부담이 생길 수 있어요.')]) })])
    open()

    const reason = part('신호 이유')
    expect(reason.getByText('제재를 받은 것이라 부담이 생길 수 있어요.')).toBeTruthy()
    expect(reason.getByText('일반적인 설명이에요.')).toBeTruthy()
    expect(reason.queryByText('AI 생성')).toBeNull()
  })

  it('섞인 소송의 신호 이유가 실패하면 코드 첫 줄과 행 건수만 보인다(AC20)', () => {
    show([event({ kind: '소송', changeName: '진행', signal: 'HOLD', holdReason: 'MIXED_LITIGATION', rowCounts: { changed: 2, added: 3, missing: 11 }, signalReason: sentence('FALLBACK', []) })])
    open()

    const reason = part('신호 이유')
    expect(reason.getByText('여러 소송의 진행 상황이 섞여 있어요.')).toBeTruthy()
    expect(reason.getByText('바뀐 행 2건 · 새 행 3건 · 이번엔 없는 행 11건')).toBeTruthy()
    expect(reason.queryByText('일반적인 설명이에요.')).toBeNull()
  })

  it('모든 칸을 펼친 카드와 기준표에 접근성 위반이 없다', async () => {
    const { container } = show([event({ ...generated, glossary: [{ term: '과징금', meaning: '뜻', source: '법령' }] })])
    open()
    expect(await axeViolations(container)).toBe('')

    fireEvent.click(screen.getByRole('button', { name: '기준 보기' }))

    expect(await axeViolations(document.body)).toBe('')
  })
})

describe('TextEventsSection 사실 칸', () => {
  const treasury = {
    accountType: null,
    changeId: 905,
    sjDiv: 'BS',
    accountName: '자기주식',
    previousAmount: 1_200_000_000,
    currentAmount: 3_450_000_000,
    changeAmount: 2_250_000_000,
    changeRate: 1.875,
    calcStatus: 'OK',
    currency: 'KRW',
  } as const
  const facts = () => within(screen.getByRole('heading', { name: '관련 재무 숫자' }).closest('section') as HTMLElement)

  it('계정이 있는 종류는 펼친 카드에 재무 수치 탭과 같은 값과 원인이 아니라는 안내가 보인다(AC28)', () => {
    show([event({ kind: '자기주식 취득·처분', kindCode: 'TREASURY_STOCK', facts: [treasury] })])
    open()

    const row = facts().getByRole('row', { name: /자기주식/ })
    expect(within(row).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['1,200', '3,450', '▲ 2,250', '+187.5%'])
    expect(facts().getByText('재무 수치 탭과 같은 값이에요. 이 사건이 숫자를 바꾼 원인이라는 뜻은 아니에요.')).toBeTruthy()
    expect(facts().getByText('단위: 백만원')).toBeTruthy()
  })

  it('계정이 없는 종류는 칸이 없다(AC28)', () => {
    show([event()])
    open()

    expect(screen.queryByRole('heading', { name: '관련 재무 숫자' })).toBeNull()
  })

  it('두 값이 모두 없으면 칸이 없다(AC28)', () => {
    show([event({ facts: [{ ...treasury, previousAmount: null, currentAmount: null, changeAmount: null, changeRate: null, calcStatus: 'PREVIOUS_MISSING' }] })])
    open()

    expect(screen.queryByRole('heading', { name: '관련 재무 숫자' })).toBeNull()
  })

  it('사실 칸에 접근성 위반이 없다', async () => {
    const { container } = show([event({ facts: [treasury] })])
    open()

    expect(await axeViolations(container)).toBe('')
  })
})

describe('TextEventsSection 신호 필터', () => {
  const items = () => [
    event({ eventId: 1, title: '첫째 보류', signal: 'HOLD', holdReason: 'NO_CRITERIA' }),
    event({ eventId: 2, title: '둘째 주의' }),
    event({ eventId: 3, title: '셋째 보류', signal: 'HOLD', holdReason: 'NO_CRITERIA' }),
  ]
  const titles = () => screen.getAllByRole('article').map((card) => card.getAttribute('aria-label'))
  const chip = (name: RegExp) => within(screen.getByRole('group', { name: '신호로 거르기' })).getByRole('button', { name })

  it('신호마다 건수가 보이고 처음에는 전체가 눌려 있다', () => {
    show(items())

    expect(chip(/^전체/).getAttribute('aria-pressed')).toBe('true')
    expect(chip(/^주의/).textContent).toBe('주의 1')
    expect(chip(/^긍정/).textContent).toBe('긍정 0')
    expect(chip(/^보류/).textContent).toBe('보류 2')
  })

  it('신호를 누르면 그 신호의 사건만 보인다(AC29)', () => {
    show(items())

    fireEvent.click(chip(/^보류/))

    expect(titles()).toEqual(['첫째 보류', '셋째 보류'])
    expect(chip(/^보류/).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('heading', { name: '주요 사건 2건' })).toBeTruthy()
  })

  it('그 신호의 사건이 없으면 안내가 보인다', () => {
    show(items())

    fireEvent.click(chip(/^긍정/))

    expect(screen.queryAllByRole('article')).toEqual([])
    expect(screen.getByRole('status').textContent).toBe('긍정 신호가 붙은 사건이 없어요.')
  })

  it('전체를 누르면 원래 순서로 돌아간다', () => {
    show(items())

    fireEvent.click(chip(/^주의/))
    fireEvent.click(chip(/^전체/))

    expect(titles()).toEqual(['첫째 보류', '둘째 주의', '셋째 보류'])
  })

  it('사건이 하나면 필터를 두지 않는다', () => {
    show([event()])

    expect(screen.queryByRole('group', { name: '신호로 거르기' })).toBeNull()
  })

  it('필터에 접근성 위반이 없다', async () => {
    const { container } = show(items())

    fireEvent.click(chip(/^긍정/))

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

  it('사건에 들지 않은 후보는 카드 없이 건수 한 줄로 알린다(3.60 AC24)', () => {
    area(ready([event()], [unbound(11), unbound(12)]))

    expect(screen.getByText('사건에 들지 않은 후보 2건은 아래 전체 변경에서 볼 수 있어요.')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /사건으로 묶이지 않은/ })).toBeNull()
    expect(screen.queryByText('현재 글 11')).toBeNull()
    expect(screen.queryByRole('button', { name: '원문 비교' })).toBeNull()
  })

  it('사건이 하나도 없어도 들지 않은 후보 한 줄은 보이고 주요 사건 제목은 없다', () => {
    area(ready([], [unbound(11)]))

    expect(screen.getByText('사건에 들지 않은 후보 1건은 아래 전체 변경에서 볼 수 있어요.')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /^주요 사건/ })).toBeNull()
  })

  it('분야를 고르면 그 칸의 건수만 센다(AC24)', () => {
    area(ready([], [unbound(11), unbound(12, { field: 'LITIGATION' })]), { ...noFilter, field: 'LITIGATION' })

    expect(screen.getByText('사건에 들지 않은 후보 1건은 아래 전체 변경에서 볼 수 있어요.')).toBeTruthy()
  })

  it('들지 않은 후보가 0건이면 그 줄이 없고 뺀 사건 안내는 그대로다(AC25)', () => {
    area({ status: 'ready', list: { droppedEventCount: 1, items: [event()], unboundChanges: [] } as unknown as TextEventList })

    expect(screen.queryByText(/사건에 들지 않은 후보/)).toBeNull()
    expect(screen.getByText('근거를 확인하지 못한 사건은 보여 주지 않았어요.')).toBeTruthy()
  })

  it('들지 않은 후보 안내에 접근성 위반이 없다', async () => {
    const { container } = area(ready([event()], [unbound(11)]))

    expect(await axeViolations(container)).toBe('')
  })
})
