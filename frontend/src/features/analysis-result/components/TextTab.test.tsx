// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import type { ChangeType, TextChangeCounts, TextChangeItem, TextChangeList, TextField, TextListGroup, TextListing } from '@/shared/api/textChanges'
import type { TextEventList } from '@/shared/api/textEvents'
import type { TextEventsView } from '../model/textEvents'
import { axeViolations } from '@/test/axe'
import type { TextListState } from '../model/textList'
import { TextTab } from './TextTab'

// 카드 키보드 검토(#311)만 보도록 목록·고정·풀이 훅을 바꿔 끼운다
const pins = vi.hoisted(() => ({ toggle: vi.fn(), ids: [] as number[] }))
const list = vi.hoisted(() => ({
  items: [] as TextChangeItem[],
  riskCounts: null as TextChangeCounts | null,
  counts: null as TextChangeCounts | null,
  listing: null as TextListing | null,
  state: null as TextListState | null,
  type: null as ChangeType | null,
  reload: vi.fn(),
  groups: {} as Partial<Record<TextListGroup, TextListState>>,
}))
vi.mock('../hooks/useTextChanges', () => ({
  useTextChanges: () => ({
    state: list.state ?? {
      status: 'success',
      data: { page: 0, totalItems: list.items.length, items: list.items } as unknown as TextChangeList,
      items: list.items,
      more: { status: 'idle' },
    },
    counts: list.counts,
    sections: [],
    riskCounts: list.riskCounts,
    listing: list.listing,
    contentAvailable: false,
    type: list.type,
    reload: list.reload,
    loadMore: () => {},
  }),
  useTextChangeGroup: (_analysisId: number, group: TextListGroup) => ({
    state: list.groups[group] ?? { status: 'loading' },
    reload: list.reload,
    loadMore: () => {},
  }),
  // 원문 비교 창의 내용은 TextEvidencePanel 테스트가 본다. 여기서는 창이 열리고 닫히는 것만 본다
  useTextChangeDetail: () => ({ state: { status: 'loading' }, reload: () => {} }),
}))
// 사건 절의 내용은 TextEventsSection 테스트가 본다
const events = vi.hoisted(() => ({ list: null as TextEventList | null, view: { status: 'hidden' } as TextEventsView, retry: vi.fn() }))
const detail = vi.hoisted(() => ({ state: { status: 'loading' } as unknown }))
vi.mock('../hooks/useTextEvents', () => ({
  useTextEvents: () => ({ view: events.list === null ? events.view : { status: 'ready', list: events.list }, retry: events.retry }),
  useTextEventDetail: () => ({ state: detail.state, reload: () => {} }),
}))
vi.mock('../hooks/usePinnedChanges', () => ({
  usePinnedChanges: () => ({
    ids: pins.ids,
    isPinned: (id: number) => pins.ids.includes(id),
    toggle: pins.toggle,
    remove: () => {},
  }),
  usePinnedTextChanges: () => ({ view: { status: 'success', items: [] }, reload: () => {} }),
}))
vi.mock('../hooks/useTextExplanations', () => ({
  useTextExplanations: () => ({ request: () => {}, entryOf: () => ({ status: 'loading' }) }),
}))
// 카드의 '노트에 담기'(FS-57)는 로그인 상태만 본다
vi.mock('@/shared/auth/authContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/auth/authContext')>()),
  useAuth: () => ({ state: { status: 'anonymous' }, login: vi.fn(), logout: vi.fn() }),
}))

beforeAll(() => {
  // jsdom에는 scrollIntoView가 없다
  Element.prototype.scrollIntoView = vi.fn()
})
beforeEach(() => {
  pins.toggle.mockReset()
  pins.ids = []
  list.riskCounts = null
  list.counts = null
  list.listing = null
  list.state = null
  list.type = null
  list.reload.mockReset()
  list.groups = {}
  events.list = null
  events.view = { status: 'hidden' }
  detail.state = { status: 'loading' }
})
afterEach(cleanup)

const report = (rceptNo: string, reportName: string) => ({ rceptNo, reportName, reportType: 'ANNUAL', fiscalYear: 2024 })
const analysis = {
  analysisId: 16,
  corpCode: '00126380',
  textStatus: 'COMPLETED',
  textMessage: null,
  previous: report('20240314000100', '사업보고서 (2023.12)'),
  current: report('20250314000100', '사업보고서 (2024.12)'),
} as unknown as Analysis

function item(changeId: number, sectionTitle: string): TextChangeItem {
  return {
    changeId,
    changeNo: changeId,
    changeType: 'MODIFIED',
    blockType: 'PARAGRAPH',
    numbersOnly: false,
    sectionStatus: 'MODIFIED',
    sectionTitle,
    sectionPath: `II. 사업의 내용 > ${sectionTitle}`,
    previousSectionPath: null,
    previousPreview: '이전 문장이에요.',
    currentPreview: '바뀐 문장이에요.',
    similarity: 0.8,
    reviewReason: null,
    priority: null,
    riskRelated: false,
    listGroup: 'MAIN',
    field: 'BUSINESS',
    raisedFromNote: false,
    noteScope: null,
    rowDiff: null,
  }
}

function renderTab(onChange = vi.fn()) {
  list.items = [item(1, '1. 사업의 개요'), item(2, '2. 주요 제품'), item(3, '3. 원재료')]
  const view = render(
    <MemoryRouter>
      <main>
        <TextTab
          analysis={analysis}
          type={null}
          sort="priority"
          section={null}
          q={null}
          risk={false}
          field={null}
          pinned={false}
          selectedChangeId={null}
          onChange={onChange}
          onOpenSource={() => {}}
          onAsk={() => {}}
          asking={false}
        />
      </main>
    </MemoryRouter>,
  )
  const cards = screen.getAllByRole('article')
  return { ...view, cards, onChange }
}

/** 지금 초점이 있는 곳에서 키를 누른다(문서까지 올라가 단축키가 받는다) */
function press(key: string) {
  fireEvent.keyDown(document.activeElement ?? document.body, { key })
}

describe('TextTab 카드 키보드 검토', () => {
  it('카드에 초점이 없으면 j로 첫 카드에 가고, j·k로 다음·이전 카드로 옮긴다', () => {
    const { cards } = renderTab()
    press('j')
    expect(document.activeElement).toBe(cards[0])
    press('j')
    press('ㅓ')
    expect(document.activeElement).toBe(cards[2])
    press('k')
    expect(document.activeElement).toBe(cards[1])
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('카드에 초점이 있으면 ↓·↑로도 옮긴다', () => {
    const { cards } = renderTab()
    press('j')
    press('ArrowDown')
    expect(document.activeElement).toBe(cards[1])
    press('ArrowUp')
    expect(document.activeElement).toBe(cards[0])
  })

  it('카드에서 Enter를 누르면 그 카드의 근거를 연다', () => {
    const { onChange } = renderTab()
    press('j')
    press('j')
    press('Enter')
    expect(onChange).toHaveBeenCalledWith({ change: 2 })
  })

  it('카드 안 버튼에서 누른 Enter는 단축키로 받지 않는다', () => {
    const { cards, onChange } = renderTab()
    const button = within(cards[0]).getByRole('button', { name: '원문 비교' })
    button.focus()
    press('Enter')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('p를 누르면 초점이 있는 카드를 고정하고, 카드 안 버튼에 있어도 그 카드를 고정한다', () => {
    const { cards } = renderTab()
    press('j')
    press('p')
    expect(pins.toggle).toHaveBeenLastCalledWith(1)
    ;(cards[2].querySelector('button') as HTMLButtonElement).focus()
    press('ㅔ')
    expect(pins.toggle).toHaveBeenLastCalledWith(3)
  })

  it('문장 검색 입력창에서 j·p를 치면 카드를 옮기거나 고정하지 않는다', () => {
    renderTab()
    const input = screen.getByLabelText('문장 검색')
    input.focus()
    press('j')
    press('p')
    expect(document.activeElement).toBe(input)
    expect(pins.toggle).not.toHaveBeenCalled()
  })

  it('카드에 초점이 있는 상태에서도 접근성 위반이 없다', async () => {
    const { container } = renderTab()
    press('j')
    expect(await axeViolations(container)).toBe('')
  })
})

describe('TextTab 원문 비교(#507)', () => {
  // 주소의 tc처럼 고른 항목을 실제로 바꾸는 화면
  function Harness({ initial }: { initial: number | null }) {
    const [selected, setSelected] = useState<number | null>(initial)
    return (
      <MemoryRouter>
        <main>
          <TextTab
            analysis={analysis}
            type={null}
            sort="priority"
            section={null}
            q={null}
            risk={false}
            field={null}
            pinned={false}
            selectedChangeId={selected}
            onChange={(change) => {
              if ('change' in change) setSelected(change.change ?? null)
            }}
            onOpenSource={() => {}}
            onAsk={() => {}}
            asking={false}
          />
        </main>
      </MemoryRouter>
    )
  }

  it('카드에서 열면 창이 뜨고, Esc로 닫으면 창이 사라지고 그 카드의 원문 비교로 초점이 돌아온다', async () => {
    list.items = [item(1, '1. 사업의 개요'), item(2, '2. 주요 제품')]
    render(<Harness initial={null} />)
    const button = within(screen.getAllByRole('article')[1]).getByRole('button', { name: '원문 비교' })
    button.focus()
    fireEvent.click(button)

    const dialog = screen.getByRole('dialog', { name: '원문 비교' })
    fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(button))
  })

  it('지금 목록에 없는 항목을 주소로 고르면 같은 창이 열린다', () => {
    list.items = [item(1, '1. 사업의 개요')]
    render(<Harness initial={99} />)
    expect(screen.getByRole('dialog', { name: '원문 비교' })).toBeTruthy()
  })

  it('카드에는 문단 펼치기가 없고, 원문 비교와 커뮤니티에 인용을 제공한다', () => {
    const { cards, onChange } = renderTab()
    expect(cards[0].textContent).not.toContain('문단 펼치기')
    expect(cards[0].querySelector('.change-card__sides--clamped')).not.toBeNull()
    fireEvent.click(within(cards[0]).getByRole('button', { name: /^메뉴:/ }))
    expect(within(cards[0]).getByRole('link', { name: '커뮤니티에 인용' }).getAttribute('href')).toBe(
      '/companies/00126380?view=community&quoteAnalysis=16&quoteKind=TEXT_CHANGE&quoteChange=1',
    )
    const button = within(cards[0]).getByRole('button', { name: '원문 비교' })
    expect(button.getAttribute('aria-haspopup')).toBe('dialog')
    fireEvent.click(button)
    expect(onChange).toHaveBeenCalledWith({ change: 1 })
  })
})

describe('TextTab 종류 안내(#393)', () => {
  it('삭제 안내 문장은 목록에서 첫 삭제 카드에만 보인다', () => {
    list.items = [
      { ...item(1, '1. 사업의 개요'), changeType: 'DELETED', currentPreview: null },
      { ...item(2, '2. 주요 제품'), changeType: 'DELETED', currentPreview: null },
    ]
    render(
      <MemoryRouter>
        <main>
          <TextTab
            analysis={analysis}
            type={null}
            sort="priority"
            section={null}
            q={null}
            risk={false}
            field={null}
            pinned={false}
            selectedChangeId={null}
            onChange={vi.fn()}
            onOpenSource={() => {}}
            onAsk={() => {}}
            asking={false}
          />
        </main>
      </MemoryRouter>,
    )
    const cards = screen.getAllByRole('article')
    expect(cards[0].textContent).toContain('빠졌다고 끝났다는 뜻은 아니에요')
    expect(cards[1].textContent).not.toContain('빠졌다고 끝났다는 뜻은 아니에요')
  })
})

describe('TextTab 위험 요인 변화(3.9, FS-61)', () => {
  const zero: TextChangeCounts = { all: 0, added: 0, deleted: 0, modified: 0, numericUpdate: 0, moved: 0, reviewNeeded: 0 }

  function renderRisk(risk: boolean, onChange = vi.fn()) {
    render(
      <MemoryRouter>
        <main>
          <TextTab
            analysis={analysis}
            type={null}
            sort="priority"
            section={null}
            q={null}
            risk={risk}
            field={null}
            pinned={false}
            selectedChangeId={null}
            onChange={onChange}
            onOpenSource={() => {}}
            onAsk={() => {}}
            asking={false}
          />
        </main>
      </MemoryRouter>,
    )
    return { onChange, card: screen.getByRole('region', { name: '위험 요인 변화' }) }
  }

  it('카드에 새로 생긴·사라진·바뀐 건수와 목차로 나눴다는 안내를 보인다(AC1)', () => {
    list.items = [item(1, '5. 위험관리 및 파생거래')]
    list.riskCounts = { ...zero, all: 6, added: 2, deleted: 1, modified: 3 }
    const { card } = renderRisk(false)
    expect(card.textContent).toContain('새로 생긴 문장')
    expect(card.textContent).toContain('사라진 문장')
    expect(card.textContent).toContain('바뀐 문장')
    expect(card.textContent).toContain('목차 제목으로 나눈 것이라 실제 내용과 다를 수 있어요.')
    expect(card.querySelectorAll('.stat-number')).toHaveLength(3)
  })

  it('위험 관련 변경이 없으면 카드에 없다고 안내한다(AC3)', () => {
    list.items = [item(1, '1. 사업의 개요')]
    list.riskCounts = zero
    const { card } = renderRisk(false)
    expect(card.textContent).toContain('위험 관련 목차에서 바뀐 문장이 없어요.')
    expect(card.querySelectorAll('.stat-number')).toHaveLength(0)
  })

  it("'위험 관련만'을 누르면 주소에 남기도록 risk를 바꾸고, 켜져 있으면 끈다(AC2)", () => {
    list.items = []
    list.riskCounts = { ...zero, all: 1, added: 1 }
    const off = renderRisk(false)
    fireEvent.click(screen.getByRole('button', { name: /위험 관련만/ }))
    expect(off.onChange).toHaveBeenCalledWith({ risk: true })
    cleanup()
    const on = renderRisk(true)
    const chip = screen.getByRole('button', { name: /위험 관련만/ })
    expect(chip.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(chip)
    expect(on.onChange).toHaveBeenCalledWith({ risk: false })
  })

  it('위험 관련만 보는데 항목이 없으면 빈 안내와 전체 보기 버튼을 둔다', () => {
    list.items = []
    list.riskCounts = zero
    const { onChange } = renderRisk(true)
    expect(screen.getAllByText('위험 관련 목차에서 바뀐 문장이 없어요.')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: '전체 변경 보기' }))
    expect(onChange).toHaveBeenCalledWith({ risk: false })
  })

  it("위험 관련 항목 카드에만 '위험 관련' 배지를 단다", () => {
    list.items = [{ ...item(1, '5. 위험관리 및 파생거래'), riskRelated: true }, item(2, '1. 사업의 개요')]
    list.riskCounts = { ...zero, all: 1, modified: 1 }
    renderRisk(false)
    const cards = screen.getAllByRole('article')
    expect(cards[0].textContent).toContain('위험 관련')
    expect(cards[1].textContent).not.toContain('위험 관련')
  })

  it('카드에 접근성 위반이 없다', async () => {
    list.items = [item(1, '5. 위험관리 및 파생거래')]
    list.riskCounts = { ...zero, all: 2, added: 1, modified: 1 }
    renderRisk(false)
    expect(await axeViolations(document.body)).toBe('')
  })
})

describe('TextTab 주요 사건(3.37)', () => {
  const listing: TextListing = {
    listVersion: 'text-list-1',
    fieldCounts: { LITIGATION: 38, CONTRACT: 0, BUSINESS: 247, DIVIDEND: 0, FUNDING: 0, BOARD: 0, SHAREHOLDER: 0, AUDIT: 0, OTHER: 0 },
    missingFields: [],
    groupCounts: null,
  }
  const textEvents = (changeId: number) =>
    ({
      droppedEventCount: 0,
      fieldCounts: [{ field: 'LITIGATION', eventCount: 1 }],
      items: [
        {
          eventId: 7,
          title: '과징금을 새로 부과받았어요',
          kind: '제재',
          fields: ['LITIGATION'],
          changeIds: [changeId],
          quotes: [{ changeId, purpose: 'CHANGE', side: 'CURRENT', text: '이번 글', evidenceId: '20250314000100#B1', sectionPath: 'XI. 그 밖에' }],
        },
      ],
      unboundChanges: [],
    }) as unknown as TextEventList

  function Harness({ field = null }: { field?: TextField | null }) {
    const [selected, setSelected] = useState<number | null>(null)
    return (
      <MemoryRouter>
        <main>
          <TextTab
            analysis={analysis}
            type={null}
            sort="priority"
            section={null}
            q={null}
            risk={false}
            field={field}
            pinned={false}
            selectedChangeId={selected}
            onChange={(change) => {
              if ('change' in change) setSelected(change.change ?? null)
            }}
            onOpenSource={() => {}}
            onAsk={() => {}}
            asking={false}
          />
        </main>
      </MemoryRouter>
    )
  }

  const table = () => within(screen.getByRole('group', { name: '분야별 변경' }))

  beforeEach(() => {
    list.listing = listing
    list.items = [item(1, '1. 사업의 개요')]
  })

  it('사건을 받으면 표의 칸에 관련 사건 수가 보이고 표 아래에 사건 절이 있다(AC1)', () => {
    events.list = textEvents(1)
    render(<Harness />)

    expect(table().getByRole('button', { name: /소송·제재.*관련 주요 사건 1건/ })).toBeTruthy()
    expect(table().getByRole('button', { name: /사업 내용.*관련 주요 사건 없음/ })).toBeTruthy()
    const heading = screen.getByRole('heading', { name: '주요 사건 1건' })
    const fieldTable = screen.getByRole('group', { name: '분야별 변경' })
    expect(fieldTable.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('사건이 없으면 사건 절과 칸의 사건 수만 빠지고 목록은 그대로다(AC21)', () => {
    render(<Harness />)

    expect(screen.queryByRole('heading', { name: /주요 사건/ })).toBeNull()
    expect(screen.queryByText(/관련 주요 사건/)).toBeNull()
    expect(screen.getByRole('article', { name: /1\. 사업의 개요/ })).toBeTruthy()
  })

  it('만드는 중이면 표 다음에 진행 표시가 있고 목록은 그대로 보인다(AC33)', () => {
    events.view = { status: 'building' }
    render(<Harness />)

    const progress = screen.getByText(/주요 사건을 만드는 중이에요/)
    const fieldTable = screen.getByRole('group', { name: '분야별 변경' })
    expect(fieldTable.compareDocumentPosition(progress) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('article', { name: /1\. 사업의 개요/ })).toBeTruthy()
    expect(screen.queryByText(/관련 주요 사건/)).toBeNull()
  })

  it('만들지 못했으면 안내와 표, 목록이 보이고 칸의 사건 수는 없다(AC21)', () => {
    events.view = { status: 'unavailable', retry: 'available' }
    render(<Harness />)

    expect(screen.getByText(/주요 사건을 만들지 못했어요/)).toBeTruthy()
    expect(screen.getByRole('group', { name: '분야별 변경' })).toBeTruthy()
    expect(screen.getByRole('article', { name: /1\. 사업의 개요/ })).toBeTruthy()
    expect(screen.queryByText(/관련 주요 사건/)).toBeNull()
  })

  it('만들지 못한 안내의 다시 시도를 누르면 사건을 다시 만든다', () => {
    events.view = { status: 'unavailable', retry: 'available' }
    events.retry.mockReset()
    render(<Harness />)

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(events.retry).toHaveBeenCalledTimes(1)
  })

  it('변경이 한 건도 없으면 빈 화면 안내만 있고 사건 자리는 없다(AC26)', () => {
    list.listing = null
    list.items = []
    for (const view of [{ status: 'building' }, { status: 'unavailable', retry: 'available' }, { status: 'empty' }] as TextEventsView[]) {
      events.view = view
      const { unmount } = render(<Harness />)
      expect(screen.getByText('두 보고서 사이에 바뀐 문장·표가 없어요.')).toBeTruthy()
      expect(screen.queryByText(/주요 사건/)).toBeNull()
      unmount()
    }
  })

  it('옛 분석은 사건 자리 없이 지금 목록이 보인다', () => {
    list.listing = null
    render(<Harness />)

    expect(screen.queryByText(/주요 사건/)).toBeNull()
    expect(screen.getByRole('article', { name: /1\. 사업의 개요/ })).toBeTruthy()
  })

  it('묶이지 않은 변경의 원문 비교를 열었다가 닫으면 그 버튼으로 초점이 돌아온다', async () => {
    events.list = {
      ...textEvents(1),
      unboundChanges: [{ changeId: 99, changeType: 'MODIFIED', field: 'CONTRACT', sectionPath: 'II. 사업의 내용', previousPreview: '이전 글', currentPreview: '현재 글' }],
    }
    render(<Harness />)
    const section = within(screen.getByRole('heading', { name: /사건으로 묶이지 않은/ }).closest('section') as HTMLElement)
    const opener = section.getByRole('button', { name: '원문 비교' })
    opener.focus()

    fireEvent.click(opener)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await waitFor(() => expect(document.activeElement).toBe(opener))
  })

  it('분야를 고르면 그 칸의 사건만 보이고 유형으로 거르면 사건 절이 빠진다', () => {
    events.list = textEvents(1)
    const { rerender } = render(<Harness field="LITIGATION" />)
    expect(screen.getByRole('heading', { name: '주요 사건 1건' })).toBeTruthy()

    rerender(<Harness field="BUSINESS" />)
    expect(screen.queryByRole('heading', { name: /주요 사건/ })).toBeNull()

    list.type = 'ADDED'
    rerender(<Harness />)
    expect(screen.queryByRole('heading', { name: /주요 사건/ })).toBeNull()
  })

  it('목록에 없는 변경도 인용에서 원문 비교를 열고, 닫으면 그 버튼으로 초점이 돌아온다', async () => {
    events.list = textEvents(99)
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: '펼치기' }))
    const opener = within(screen.getByRole('article', { name: '과징금을 새로 부과받았어요' })).getByRole('button', { name: '원문 비교' })
    opener.focus()

    fireEvent.click(opener)
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(opener))
  })

  it('같은 변경이 목록에도 있을 때 사건 안에서 연 원문 비교를 닫으면 사건 안의 버튼으로 초점이 돌아온다', async () => {
    events.list = textEvents(1)
    detail.state = { status: 'success', data: { changes: [item(1, '1. 사업의 개요')] } }
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: '펼치기' }))
    fireEvent.click(screen.getByRole('button', { name: '변경 보기 1건' }))
    const opener = document.getElementById('text-evidence-button-event-7-1') as HTMLElement
    opener.focus()

    fireEvent.click(opener)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await waitFor(() => expect(document.activeElement).toBe(opener))
  })

  it('버튼을 거치지 않고 다른 변경을 열었다가 닫으면 먼저 연 버튼이 아니라 그 변경의 버튼으로 초점이 돌아온다', async () => {
    list.items = [item(1, '1. 사업의 개요'), item(2, '2. 주요 제품')]
    function FromCitation() {
      const [selected, setSelected] = useState<number | null>(null)
      return (
        <MemoryRouter>
          <main>
            {/* 채팅 인용처럼 주소의 변경 번호만 바꾸는 경로 */}
            <button type="button" onClick={() => setSelected(2)}>
              인용으로 열기
            </button>
            <TextTab
              analysis={analysis}
              type={null}
              sort="priority"
              section={null}
              q={null}
              risk={false}
              field={null}
              pinned={false}
              selectedChangeId={selected}
              onChange={(change) => {
                if ('change' in change) setSelected(change.change ?? null)
              }}
              onOpenSource={() => {}}
              onAsk={() => {}}
              asking={false}
            />
          </main>
        </MemoryRouter>
      )
    }
    render(<FromCitation />)
    const first = document.getElementById('text-evidence-button-1') as HTMLElement
    first.focus()
    fireEvent.click(first)
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '인용으로 열기' }))
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('text-evidence-button-2')))
  })

  it('같은 변경이 목록과 사건 안에 함께 있어도 원문 비교 버튼의 id가 겹치지 않고 카드 메뉴가 그대로 있다(AC31)', () => {
    events.list = textEvents(1)
    list.groups = {}
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: '펼치기' }))
    detail.state = { status: 'success', data: { changes: [item(1, '1. 사업의 개요')] } }

    fireEvent.click(screen.getByRole('button', { name: '변경 보기 1건' }))

    const ids = screen.getAllByRole('button', { name: '원문 비교' }).map((button) => button.id).filter(Boolean)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
    expect(screen.getAllByRole('button', { name: /메뉴: / })).toHaveLength(2)
  })
})

describe('TextTab 분야별 표(3.28)', () => {
  const listing: TextListing = {
    listVersion: 'text-list-1',
    fieldCounts: { LITIGATION: 38, CONTRACT: 11, BUSINESS: 247, DIVIDEND: 0, FUNDING: 46, BOARD: 93, SHAREHOLDER: 0, AUDIT: 15, OTHER: 132 },
    missingFields: ['SHAREHOLDER'],
    groupCounts: null,
  }

  function renderFields(field: TextField | null, onChange = vi.fn(), items: TextChangeItem[] = [item(1, '1. 사업의 개요')], risk = false) {
    list.items = items
    render(
      <MemoryRouter>
        <main>
          <TextTab
            analysis={analysis}
            type={null}
            sort="priority"
            section={null}
            q={null}
            risk={risk}
            field={field}
            pinned={false}
            selectedChangeId={null}
            onChange={onChange}
            onOpenSource={() => {}}
            onAsk={() => {}}
            asking={false}
          />
        </main>
      </MemoryRouter>,
    )
    return onChange
  }

  const table = () => within(screen.getByRole('group', { name: '분야별 변경' }))

  it('9칸과 합계를 보이고 0건과 섹션 없음을 구분한다(AC1, AC2)', () => {
    list.listing = listing
    renderFields(null)
    expect(table().getAllByRole('button')).toHaveLength(9)
    expect(screen.getByText('합계 582건')).toBeTruthy()
    expect(table().getByRole('button', { name: /소송·제재.*38건/ })).toBeTruthy()
    expect(table().getByRole('button', { name: /배당.*확인된 변화 없음/ })).toBeTruthy()
    expect(table().getByRole('button', { name: /주주.*보고서에 해당 내용 없음/ })).toBeTruthy()
  })

  it('칸을 누르면 그 분야로 거르고 고른 칸을 표시한다(AC3)', () => {
    list.listing = listing
    const onChange = renderFields(null)
    fireEvent.click(table().getByRole('button', { name: /감사/ }))
    expect(onChange).toHaveBeenCalledWith({ field: 'AUDIT' })
  })

  it('고른 칸을 다시 누르거나 전체 분야 보기를 누르면 풀린다', () => {
    list.listing = listing
    const onChange = renderFields('AUDIT')
    const cell = table().getByRole('button', { name: /감사/ })
    expect(cell.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(cell)
    expect(onChange).toHaveBeenLastCalledWith({ field: null })
    onChange.mockClear()
    fireEvent.click(screen.getByRole('button', { name: '전체 분야 보기' }))
    expect(onChange).toHaveBeenLastCalledWith({ field: null })
  })

  it('0건 칸은 누를 수 없다', () => {
    list.listing = listing
    renderFields(null)
    expect((table().getByRole('button', { name: /배당/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('분야를 고르면 분석 전체를 센 유형 건수를 칩에 보이지 않는다', () => {
    list.listing = listing
    list.counts = { all: 900, added: 1, deleted: 1, modified: 1, numericUpdate: 0, moved: 0, reviewNeeded: 0 }
    renderFields('AUDIT')
    const chips = within(screen.getByRole('group', { name: '변경 유형' }))
    expect(chips.queryByText(/900/)).toBeNull()
  })

  it('고른 분야에 변경이 없으면 그 분야가 없다고 안내하고 풀 수 있다', () => {
    list.listing = listing
    const onChange = renderFields('DIVIDEND', vi.fn(), [])
    expect(screen.getByText('배당 변경이 없어요.')).toBeTruthy()
    fireEvent.click(within(screen.getByText('배당 변경이 없어요.').parentElement as HTMLElement).getByRole('button', { name: '전체 분야 보기' }))
    expect(onChange).toHaveBeenLastCalledWith({ field: null })
  })

  it('분야와 유형을 함께 걸어 0건이면 그 분야에 변경이 없다고 말하지 않고 조건을 지울 수 있다', () => {
    list.listing = listing
    list.type = 'ADDED'
    const onChange = renderFields('AUDIT', vi.fn(), [])
    expect(screen.queryByText('감사 변경이 없어요.')).toBeNull()
    expect(screen.getByText('조건에 맞는 변경이 없어요.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '조건 지우기' }))
    expect(onChange).toHaveBeenLastCalledWith({ type: null, section: null, q: null, risk: false, field: null })
  })

  it('분야와 위험 관련을 함께 걸어 0건이면 위험 관련 변경이 없다고 말하지 않고 분야까지 지운다', () => {
    list.listing = listing
    const onChange = renderFields('AUDIT', vi.fn(), [], true)
    expect(screen.queryByText('위험 관련 목차에서 바뀐 문장이 없어요.')).toBeNull()
    expect(screen.getByText('조건에 맞는 변경이 없어요.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '조건 지우기' }))
    expect(onChange).toHaveBeenLastCalledWith({ type: null, section: null, q: null, risk: false, field: null })
  })

  it('옛 분석이면 표가 없고 주소의 분야는 없는 것으로 본다', () => {
    list.listing = { listVersion: null, fieldCounts: null, missingFields: null, groupCounts: null }
    renderFields('AUDIT', vi.fn(), [])
    expect(screen.queryByRole('group', { name: '분야별 변경' })).toBeNull()
    expect(screen.getByText('두 보고서 사이에 바뀐 문장·표가 없어요.')).toBeTruthy()
  })

  it('첫 응답을 기다리는 동안 표 자리에 로딩을 보인다', () => {
    list.state = { status: 'loading' }
    renderFields(null)
    expect(screen.getByText('분야별 변경을 불러오는 중입니다…')).toBeTruthy()
  })

  it('첫 조회가 실패하면 표는 그리지 않고 오류와 다시 시도를 보인다(AC11)', () => {
    list.state = { status: 'error', error: new Error('실패') }
    renderFields(null)
    expect(screen.queryByRole('group', { name: '분야별 변경' })).toBeNull()
    expect(screen.queryByText('두 보고서 사이에 바뀐 문장·표가 없어요.')).toBeNull()
    expect(screen.queryByText('분야별 변경을 불러오는 중입니다…')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(list.reload).toHaveBeenCalled()
  })

  it('접근성 위반이 없다', async () => {
    list.listing = listing
    renderFields('AUDIT')
    expect(await axeViolations(document.body)).toBe('')
  })
})

describe('TextTab 기본 목록과 접힌 묶음(3.29)', () => {
  const groupCounts = { MAIN: 2, HEADING: 3, FORMATTING: 0, MOVED: 1, NOTE: 4, PAIRED_TABLE: 0, UNPAIRED: 1 }
  const fieldCounts = { LITIGATION: 0, CONTRACT: 0, BUSINESS: 2, DIVIDEND: 0, FUNDING: 0, BOARD: 0, SHAREHOLDER: 0, AUDIT: 0, OTHER: 0 }
  const listing: TextListing = { listVersion: 'text-list-1', fieldCounts, missingFields: [], groupCounts }

  function success(items: TextChangeItem[], totalItems = items.length): TextListState {
    return { status: 'success', data: { page: 0, totalItems, items } as unknown as TextChangeList, items, more: { status: 'idle' } }
  }

  function renderDefault(over: Partial<Parameters<typeof TextTab>[0]> = {}, items: TextChangeItem[] = [item(1, '1. 사업의 개요')], current: TextListing = listing) {
    list.items = items
    list.listing = current
    render(
      <MemoryRouter>
        <main>
          <TextTab
            analysis={analysis}
            type={null}
            sort="priority"
            section={null}
            q={null}
            risk={false}
            field={null}
            pinned={false}
            selectedChangeId={null}
            onChange={() => {}}
            onOpenSource={() => {}}
            onAsk={() => {}}
            asking={false}
            {...over}
          />
        </main>
      </MemoryRouter>,
    )
  }

  const folded = () => within(screen.getByRole('region', { name: /접어 둔 변경/ }))

  it('기본 목록 건수와 짝을 정하지 못한 항목 건수를 알린다(AC9)', () => {
    renderDefault()
    expect(screen.getByText(/기본 목록 2건 · 짝을 정하지 못한 항목 1건/)).toBeTruthy()
  })

  it('접힌 묶음을 건수와 함께 보이고 0건인 묶음은 뺀다(AC4)', () => {
    renderDefault()
    expect(screen.getByRole('heading', { name: /접어 둔 변경 8건/ })).toBeTruthy()
    expect(folded().getByRole('button', { name: /재무제표 주석 4건/ }).getAttribute('aria-expanded')).toBe('false')
    expect(folded().getByRole('button', { name: /제목 줄처럼 짧은 글 3건/ })).toBeTruthy()
    expect(folded().getByRole('button', { name: /자리만 옮긴 글 1건/ })).toBeTruthy()
    expect(folded().queryByRole('button', { name: /띄어쓰기/ })).toBeNull()
  })

  it('묶음을 펼치면 그 묶음의 변경이 보이고 다시 누르면 접힌다', () => {
    list.groups = { NOTE: success([{ ...item(9, '주석 3. 금융상품'), listGroup: 'NOTE', noteScope: 'SEPARATE' }], 4) }
    renderDefault()
    const toggle = folded().getByRole('button', { name: /재무제표 주석 4건/ })
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(folded().getByText('별도 주석')).toBeTruthy()
    expect(folded().getByText('1 / 4건')).toBeTruthy()
    fireEvent.click(toggle)
    expect(folded().queryByText('별도 주석')).toBeNull()
  })

  it('묶음을 불러오지 못하면 다시 시도할 수 있다', () => {
    list.groups = { NOTE: { status: 'error', error: new Error('실패') } }
    renderDefault()
    fireEvent.click(folded().getByRole('button', { name: /재무제표 주석 4건/ }))
    fireEvent.click(folded().getByRole('button', { name: /다시 시도/ }))
    expect(list.reload).toHaveBeenCalled()
  })

  it('펼친 묶음의 변경을 고르면 원문 비교 창이 하나만 열린다', () => {
    list.groups = { NOTE: success([{ ...item(9, '주석 3. 금융상품'), listGroup: 'NOTE' }]) }
    renderDefault({ selectedChangeId: 9 })
    fireEvent.click(folded().getByRole('button', { name: /재무제표 주석 4건/ }))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  it.each([
    ['검색', { q: '소송' }],
    ['유형', { type: 'ADDED' }],
    ['섹션', { section: 'II. 사업의 내용' }],
    ['위험 관련', { risk: true }],
    ['분야', { field: 'BUSINESS' }],
    ['고정', { pinned: true }],
  ] as const)('%s 거르기에는 접힌 묶음과 기본 목록 안내를 보이지 않는다', (_name, over) => {
    // 유형은 훅이 실제로 쓴 값을 돌려준다
    list.type = 'type' in over ? over.type : null
    renderDefault(over)
    expect(screen.queryByRole('region', { name: /접어 둔 변경/ })).toBeNull()
    expect(screen.queryByText(/기본 목록 2건/)).toBeNull()
  })

  it('옛 분석에는 접힌 묶음과 기본 목록 안내가 없고 목록은 그대로다(AC13)', () => {
    renderDefault({}, [item(1, '1. 사업의 개요')], { listVersion: null, fieldCounts: null, missingFields: null, groupCounts: null })
    expect(screen.queryByRole('region', { name: /접어 둔 변경/ })).toBeNull()
    expect(screen.queryByText(/기본 목록/)).toBeNull()
    expect(screen.getByRole('article')).toBeTruthy()
  })

  it('기본 목록이 비어도 접힌 변경이 있으면 바뀐 것이 없다고 말하지 않는다', () => {
    renderDefault({}, [])
    expect(screen.queryByText('두 보고서 사이에 바뀐 문장·표가 없어요.')).toBeNull()
    expect(screen.getByText('기본 목록에 보일 변경이 없어요.')).toBeTruthy()
    expect(screen.getByRole('region', { name: /접어 둔 변경/ })).toBeTruthy()
  })

  it('올린 주석과 숫자만 바뀐 글을 카드에 표시한다(AC5, AC6)', () => {
    renderDefault({}, [
      { ...item(1, '주석 20. 우발부채'), raisedFromNote: true },
      { ...item(2, '1. 사업의 개요'), changeType: 'NUMERIC_UPDATE', numbersOnly: true },
    ])
    const cards = screen.getAllByRole('article')
    expect(within(cards[0]).getByText('주석에서 올림')).toBeTruthy()
    expect(within(cards[1]).getByText('숫자만 바뀜')).toBeTruthy()
    expect(within(cards[1]).queryByText('주석에서 올림')).toBeNull()
  })

  it('접근성 위반이 없다', async () => {
    list.groups = { NOTE: success([{ ...item(9, '주석 3. 금융상품'), listGroup: 'NOTE', noteScope: 'CONSOLIDATED' }]) }
    renderDefault()
    fireEvent.click(folded().getByRole('button', { name: /재무제표 주석 4건/ }))
    expect(await axeViolations(document.body)).toBe('')
  })
})

describe('TextTab 표 행 비교(3.30)', () => {
  function renderCards(items: TextChangeItem[]) {
    list.items = items
    render(
      <MemoryRouter>
        <main>
          <TextTab
            analysis={analysis}
            type={null}
            sort="priority"
            section={null}
            q={null}
            risk={false}
            field={null}
            pinned={false}
            selectedChangeId={null}
            onChange={() => {}}
            onOpenSource={() => {}}
            onAsk={() => {}}
            asking={false}
          />
        </main>
      </MemoryRouter>,
    )
    return screen.getAllByRole('article')
  }

  const litigation: TextChangeItem = {
    ...item(1, '2. 우발부채 등에 관한 사항'),
    changeType: 'ADDED',
    blockType: 'TABLE',
    previousPreview: null,
    currentPreview: '소제기일 | 사건의 명칭(사건번호) | 진행상황',
    rowDiff: {
      status: 'COMPARED',
      keyColumn: '사건의 명칭(사건번호)',
      counts: { changed: 5, added: 3, missing: 11, same: 1 },
      pairedPrevious: { rceptNo: '20260813001718', sectionNo: 40, blockNo: 2028 },
      changedRows: [
        {
          key: '주주총회결의취소 청구의 소(서울중앙지방법원 2025가합9085)',
          cells: [{ column: '진행상황', previous: '진행 중', current: '화해권고결정' }],
        },
        { key: '의결권행사허용가처분 재항고(대법원 2025마6793)', cells: [{ column: '진행상황', previous: '진행 중', current: '' }] },
      ],
    },
  }

  it('행 건수와 바뀐 행을 보이고 추가된 표처럼 보이지 않는다(AC7)', () => {
    const [card] = renderCards([litigation])
    const view = within(card)
    expect(view.getByText('바뀜').parentElement?.textContent).toContain('5')
    expect(view.getByText('새로').parentElement?.textContent).toContain('3')
    expect(view.getByText('이번엔 없음').parentElement?.textContent).toContain('11')
    expect(view.getByText('그대로').parentElement?.textContent).toContain('1')
    expect(view.getByText(/2025가합9085/)).toBeTruthy()
    expect(card.textContent).toContain('진행 중 → 화해권고결정')
    expect(view.getByText('표 구성 바뀜')).toBeTruthy()
    expect(view.queryByText('추가')).toBeNull()
    expect(view.queryByText('이전 보고서에 없던 내용')).toBeNull()
    expect(card.textContent).not.toContain('사라짐')
  })

  it('짝지은 열과 보이지 않는 바뀐 행 수를 알리고 빈 칸을 표시한다', () => {
    const [card] = renderCards([litigation])
    expect(card.textContent).toContain('사건의 명칭(사건번호)')
    expect(card.textContent).toContain('바뀐 행 3개가 더 있어요')
    expect(card.textContent).toContain('진행 중 → (빈 칸)')
  })

  it('행 비교를 하지 않은 표는 구분해 보이고 양쪽 글을 그대로 둔다(AC8)', () => {
    const [card] = renderCards([
      {
        ...item(1, '3. 재고자산'),
        blockType: 'TABLE',
        rowDiff: { status: 'NOT_COMPARED', keyColumn: null, counts: null, pairedPrevious: null, changedRows: [] },
      },
    ])
    expect(within(card).getByText('행 비교 안 함')).toBeTruthy()
    expect(within(card).getByText('이전 문장이에요.')).toBeTruthy()
    expect(within(card).queryByText('바뀜')).toBeNull()
  })

  it('새 표와 짝지은 이전 표는 삭제되었다고 말하지 않고 짝지은 표를 알린다', () => {
    const [card] = renderCards([
      { ...item(1, '2. 우발부채 등에 관한 사항'), changeType: 'DELETED', blockType: 'TABLE', listGroup: 'PAIRED_TABLE', currentPreview: null },
    ])
    const view = within(card)
    expect(view.getByText('표 구성 바뀜(이전 표)')).toBeTruthy()
    expect(view.queryByText('삭제')).toBeNull()
    expect(view.queryByText('삭제됨')).toBeNull()
    expect(card.textContent).not.toContain('현재 보고서에서 확인되지 않음')
    expect(card.textContent).not.toContain('빠졌다고')
    expect(card.textContent).toContain('구성이 바뀐 표로 이어져요')
    expect(view.getByText('이전 문장이에요.')).toBeTruthy()
  })

  it('짝이 없는 삭제는 지금처럼 삭제로 보인다', () => {
    const [card] = renderCards([{ ...item(1, '2. 주요 제품'), changeType: 'DELETED', currentPreview: null }])
    expect(within(card).getByText('삭제')).toBeTruthy()
    expect(within(card).getByText('삭제됨')).toBeTruthy()
    expect(card.textContent).toContain('현재 보고서에서 확인되지 않음')
  })

  it('문단이나 옛 분석(rowDiff null)에는 행 비교 표시가 없다', () => {
    const [card] = renderCards([item(1, '1. 사업의 개요')])
    expect(within(card).queryByText('행 비교 안 함')).toBeNull()
    expect(within(card).queryByText('바뀜')).toBeNull()
    expect(within(card).getByText('이전 문장이에요.')).toBeTruthy()
  })

  it('접근성 위반이 없다', async () => {
    renderCards([litigation])
    expect(await axeViolations(document.body)).toBe('')
  })
})

describe('TextTab 카드 메뉴(3.31)', () => {
  function renderCard(items: TextChangeItem[] = [item(1, '1. 사업의 개요')], onChange = vi.fn()) {
    list.items = items
    render(
      <MemoryRouter>
        <main>
          <TextTab
            analysis={analysis}
            type={null}
            sort="priority"
            section={null}
            q={null}
            risk={false}
            field={null}
            pinned={false}
            selectedChangeId={null}
            onChange={onChange}
            onOpenSource={() => {}}
            onAsk={() => {}}
            asking={false}
          />
        </main>
      </MemoryRouter>,
    )
    return screen.getAllByRole('article')[0]
  }
  const menuOf = (card: HTMLElement) => within(card).getByRole('button', { name: /^메뉴:/ })

  it('닫힌 카드에는 원문 비교와 메뉴 버튼만 보인다', () => {
    const view = within(renderCard())
    expect(view.getByRole('button', { name: '원문 비교' })).toBeTruthy()
    expect(view.queryByRole('button', { name: /^고정/ })).toBeNull()
    expect(view.queryByRole('button', { name: 'AI 한 줄 풀이' })).toBeNull()
    expect(view.queryByRole('button', { name: /노트에 담기/ })).toBeNull()
    expect(view.queryByRole('link', { name: '커뮤니티에 인용' })).toBeNull()
  })

  it('메뉴의 고정을 누르면 그 카드를 고정하고 메뉴를 닫으며 초점을 메뉴 버튼으로 돌린다', () => {
    const card = renderCard()
    const menu = menuOf(card)
    fireEvent.click(menu)
    fireEvent.click(within(card).getByRole('button', { name: '고정' }))
    expect(pins.toggle).toHaveBeenLastCalledWith(1)
    expect(menu.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(menu)
  })

  it('고정한 카드는 닫힌 채로도 고정됨이 보이고 메뉴에서 해제한다', () => {
    pins.ids = [1]
    const card = renderCard()
    expect(within(card).getByText('고정됨')).toBeTruthy()
    fireEvent.click(menuOf(card))
    fireEvent.click(within(card).getByRole('button', { name: '고정 해제' }))
    expect(pins.toggle).toHaveBeenLastCalledWith(1)
  })

  it('메뉴에서 AI 한 줄 풀이를 열고 접는다', () => {
    const card = renderCard()
    fireEvent.click(menuOf(card))
    fireEvent.click(within(card).getByRole('button', { name: 'AI 한 줄 풀이' }))
    expect(card.querySelector('#text-explain-1')).not.toBeNull()
    fireEvent.click(menuOf(card))
    fireEvent.click(within(card).getByRole('button', { name: '풀이 접기' }))
    expect(card.querySelector('#text-explain-1')).toBeNull()
  })

  it('메뉴에서 노트에 담기를 누르면 카드에 안내가 열리고 닫으면 사라진다', () => {
    const card = renderCard()
    fireEvent.click(menuOf(card))
    fireEvent.click(within(card).getByRole('button', { name: '노트에 담기' }))
    expect(within(card).getByRole('link', { name: '로그인하기' })).toBeTruthy()
    fireEvent.click(within(card).getByRole('button', { name: '닫기' }))
    expect(within(card).queryByRole('link', { name: '로그인하기' })).toBeNull()
    fireEvent.click(menuOf(card))
    fireEvent.click(within(card).getByRole('button', { name: '노트에 담기' }))
    expect(within(card).getByRole('link', { name: '로그인하기' })).toBeTruthy()
  })

  it('검토 필요 카드의 메뉴에는 커뮤니티에 인용이 없다', () => {
    const card = renderCard([{ ...item(1, '1. 사업의 개요'), changeType: 'REVIEW_NEEDED' }])
    fireEvent.click(menuOf(card))
    expect(within(card).queryByRole('link', { name: '커뮤니티에 인용' })).toBeNull()
    expect(within(card).getByRole('button', { name: '고정' })).toBeTruthy()
  })

  it('우선순위 규칙은 메뉴 밖 더 보기에 남는다', () => {
    const card = renderCard([{ ...item(1, '1. 사업의 개요'), priority: { level: 'HIGH', score: 70, reasons: ['사업의 내용 섹션 +30'] } }])
    expect(within(card).getByText('우선순위를 정한 규칙')).toBeTruthy()
  })

  it('메뉴를 연 채 p를 눌러도 고정되고 j로 다른 카드로 옮기면 메뉴가 닫힌다', () => {
    renderCard([item(1, '1. 사업의 개요'), item(2, '2. 주요 제품')])
    const [first, second] = screen.getAllByRole('article')
    const menu = menuOf(first)
    menu.focus()
    fireEvent.click(menu)
    press('p')
    expect(pins.toggle).toHaveBeenLastCalledWith(1)
    press('j')
    expect(document.activeElement).toBe(second)
    expect(menu.getAttribute('aria-expanded')).toBe('false')
  })

  it('메뉴를 펼친 카드에 접근성 위반이 없다', async () => {
    const card = renderCard()
    fireEvent.click(menuOf(card))
    expect(await axeViolations(document.body)).toBe('')
  })
})
