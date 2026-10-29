// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import type { TextChangeCounts, TextChangeItem, TextChangeList } from '@/shared/api/textChanges'
import { axeViolations } from '@/test/axe'
import { TextTab } from './TextTab'

// 카드 키보드 검토(#311)만 보도록 목록·고정·풀이 훅을 바꿔 끼운다
const pins = vi.hoisted(() => ({ toggle: vi.fn(), ids: [] as number[] }))
const list = vi.hoisted(() => ({ items: [] as TextChangeItem[], riskCounts: null as TextChangeCounts | null }))
vi.mock('../hooks/useTextChanges', () => ({
  useTextChanges: () => ({
    state: {
      status: 'success',
      data: { page: 0, totalItems: list.items.length, items: list.items } as unknown as TextChangeList,
      items: list.items,
      more: { status: 'idle' },
    },
    counts: null,
    sections: [],
    riskCounts: list.riskCounts,
    contentAvailable: false,
    type: null,
    reload: () => {},
    loadMore: () => {},
  }),
  // 원문 비교 창의 내용은 TextEvidencePanel 테스트가 본다. 여기서는 창이 열리고 닫히는 것만 본다
  useTextChangeDetail: () => ({ state: { status: 'loading' }, reload: () => {} }),
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
  useTextExplanations: () => ({ request: () => {}, entryOf: () => undefined }),
}))
// 카드의 '노트에 담기'(FS-57)는 로그인 상태만 본다
vi.mock('@/shared/auth/authContext', () => ({
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
})
afterEach(cleanup)

const report = (rceptNo: string, reportName: string) => ({ rceptNo, reportName, reportType: 'ANNUAL', fiscalYear: 2024 })
const analysis = {
  analysisId: 16,
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
  }
}

function renderTab(onChange = vi.fn()) {
  list.items = [item(1, '1. 사업의 개요'), item(2, '2. 주요 제품'), item(3, '3. 원재료')]
  const view = render(
    <main>
      <TextTab
        analysis={analysis}
        type={null}
        sort="priority"
        section={null}
        q={null}
        risk={false}
        pinned={false}
        selectedChangeId={null}
        onChange={onChange}
        onOpenSource={() => {}}
        onAsk={() => {}}
        asking={false}
      />
    </main>,
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
    const button = cards[0].querySelector('button.change-card__explain') as HTMLButtonElement
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
      <main>
        <TextTab
          analysis={analysis}
          type={null}
          sort="priority"
          section={null}
          q={null}
          risk={false}
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

  it('카드에는 문단 펼치기가 없고, 원문 비교를 누르면 그 항목을 고른다', () => {
    const { cards, onChange } = renderTab()
    expect(cards[0].textContent).not.toContain('문단 펼치기')
    expect(cards[0].querySelector('.change-card__sides--clamped')).not.toBeNull()
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
      <main>
        <TextTab
          analysis={analysis}
          type={null}
          sort="priority"
          section={null}
          q={null}
          risk={false}
          pinned={false}
          selectedChangeId={null}
          onChange={vi.fn()}
          onOpenSource={() => {}}
          onAsk={() => {}}
          asking={false}
        />
      </main>,
    )
    const cards = screen.getAllByRole('article')
    expect(cards[0].textContent).toContain('문서에서 빠졌다는 뜻이에요')
    expect(cards[1].textContent).not.toContain('문서에서 빠졌다는 뜻이에요')
  })
})

describe('TextTab 위험 요인 변화(3.9, FS-61)', () => {
  const zero: TextChangeCounts = { all: 0, added: 0, deleted: 0, modified: 0, numericUpdate: 0, moved: 0, reviewNeeded: 0 }

  function renderRisk(risk: boolean, onChange = vi.fn()) {
    render(
      <main>
        <TextTab
          analysis={analysis}
          type={null}
          sort="priority"
          section={null}
          q={null}
          risk={risk}
          pinned={false}
          selectedChangeId={null}
          onChange={onChange}
          onOpenSource={() => {}}
          onAsk={() => {}}
          asking={false}
        />
      </main>,
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
